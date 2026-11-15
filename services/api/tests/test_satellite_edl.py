"""EA1: Earthdata downloader core. No network and no token value required."""

from __future__ import annotations

import json
import sys
import threading
import time
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "seed_satellite"))

import edl  # noqa: E402

TOKEN = "unit-test-token"
EARTH = "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/HLSL30.020/tile/file.tif"
NSIDC = "https://data.nsidc.earthdatacloud.nasa.gov/next.h5"
S3 = "https://example-bucket.s3.amazonaws.com/obj.bin"


class Scripted:
    def __init__(self, steps: list[tuple[int, dict[str, str], bytes]]):
        self.steps = steps
        self.seen: list[tuple[str, dict[str, str]]] = []

    def exchange(self, url, headers, sink=None):
        self.seen.append((url, dict(headers)))
        status, hdrs, body = self.steps.pop(0)
        if sink is not None and status in (200, 206):
            sink.write(body)
            return edl.HttpResult(status, hdrs, b"", len(body))
        return edl.HttpResult(status, hdrs, body, len(body))


def _client(transport, **kwargs):
    return edl.EarthdataClient(TOKEN, transport=transport, sleep=lambda _seconds: None, **kwargs)


def test_granule_search_url_point_and_box():
    url = edl.granule_search_url(
        short_name="HLSL30",
        version="2.0",
        start=date(2024, 6, 1),
        end=date(2024, 6, 30),
        point=(-123.238, 49.2517),
    )
    parts = urlparse(url)
    assert parts.scheme == "https"
    assert parts.netloc == "cmr.earthdata.nasa.gov"
    assert parts.path == "/search/granules.json"
    query = parse_qs(parts.query)
    assert query["short_name"] == ["HLSL30"]
    assert query["version"] == ["2.0"]
    assert query["point"] == ["-123.238,49.2517"]
    assert query["temporal"] == ["2024-06-01T00:00:00Z,2024-06-30T23:59:59Z"]
    assert query["page_size"] == ["200"]
    assert "bounding_box" not in query

    boxed = edl.granule_search_url(
        short_name="NASADEM_HGT",
        version="001",
        start=datetime(2020, 1, 1, 0, 0, 0),
        end=datetime(2020, 1, 2, 0, 0, 0),
        bounding_box=(-123.25, 49.24, -123.22, 49.26),
        page_size=1,
        page_num=2,
    )
    boxed_q = parse_qs(urlparse(boxed).query)
    assert boxed_q["bounding_box"] == ["-123.25,49.24,-123.22,49.26"]
    assert boxed_q["page_num"] == ["2"]
    assert boxed_q["temporal"] == ["2020-01-01T00:00:00Z,2020-01-02T00:00:00Z"]


def test_granule_search_url_rejects_bad_input():
    kwargs = {"short_name": "HLSL30", "version": "2.0", "start": date(2024, 1, 2), "end": date(2024, 1, 1)}
    try:
        edl.granule_search_url(**kwargs)
    except ValueError as exc:
        assert "start" in str(exc)
    else:
        raise AssertionError("expected ValueError")
    try:
        edl.granule_search_url(
            short_name="HLSL30", version="2.0", start=date(2024, 1, 1), end=date(2024, 1, 2),
            point=(0, 0), bounding_box=(0, 0, 1, 1),
        )
    except ValueError as exc:
        assert "not both" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_authorization_only_on_https_earthdata_hosts():
    headers = edl.request_headers(EARTH, TOKEN, {"Range": "bytes=0-255"})
    assert headers["Authorization"] == f"Bearer {TOKEN}"
    assert headers["Range"] == "bytes=0-255"
    assert headers["Client-Id"] == edl.CLIENT_ID

    plain = edl.request_headers(S3, TOKEN, {"Range": "bytes=0-255", "Authorization": "Bearer should-not-pass"})
    assert "Authorization" not in plain
    assert "Client-Id" not in plain
    assert plain["Range"] == "bytes=0-255"

    clear = edl.request_headers("http://data.lpdaac.earthdatacloud.nasa.gov/file.tif", TOKEN)
    assert "Authorization" not in clear


def test_redirect_readds_bearer_only_on_earthdata():
    scripted = Scripted([
        (302, {"Location": NSIDC}, b""),
        (302, {"Location": S3}, b""),
        (200, {}, b"ok"),
    ])
    body = _client(scripted).get_bytes(EARTH)
    assert body == b"ok"
    assert scripted.seen[0][1]["Authorization"] == f"Bearer {TOKEN}"
    assert scripted.seen[1][1]["Authorization"] == f"Bearer {TOKEN}"
    assert "Authorization" not in scripted.seen[2][1]
    assert TOKEN not in repr(_client(Scripted([(200, {}, b"")])))


def test_relative_redirect_stays_on_the_same_host():
    scripted = Scripted([
        (302, {"Location": "/lp-prod-protected/next.tif"}, b""),
        (200, {}, b"next"),
    ])
    body = _client(scripted).get_bytes(EARTH)
    assert body == b"next"
    assert scripted.seen[1][0] == "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/next.tif"
    assert scripted.seen[1][1]["Authorization"] == f"Bearer {TOKEN}"


def test_missing_token_and_rejected_token_do_not_echo_it():
    try:
        edl.read_token(environ={})
    except edl.MissingEarthdataToken as exc:
        assert "EARTHDATA_TOKEN" in str(exc)
        assert TOKEN not in str(exc)
    else:
        raise AssertionError("expected MissingEarthdataToken")
    try:
        edl.EarthdataClient("  ")
    except edl.MissingEarthdataToken:
        pass
    else:
        raise AssertionError("expected MissingEarthdataToken")

    scripted = Scripted([(401, {}, f"denied {TOKEN}".encode())])
    try:
        _client(scripted).get_bytes("https://data.gesdisc.earthdata.nasa.gov/a.nc4")
    except edl.EarthdataRejected as exc:
        text = str(exc)
        assert "401" in text
        assert TOKEN not in text
        assert "denied" not in text
    else:
        raise AssertionError("expected EarthdataRejected")


def test_retries_honor_retry_after_then_backoff():
    scripted = Scripted([
        (503, {"Retry-After": "0.5"}, b""),
        (503, {}, b""),
        (200, {}, b"data"),
    ])
    sleeps: list[float] = []
    client = edl.EarthdataClient(TOKEN, transport=scripted, sleep=sleeps.append, backoff_s=0.25, max_retries=4)
    assert client.get_bytes(EARTH) == b"data"
    # First pause is the numeric Retry-After. The next pause is backoff * 2**attempt (attempt 1).
    assert sleeps == [0.5, 0.5]


def test_week_index_folds_the_last_days_into_week_51():
    assert edl.week_index(1) == 0
    assert edl.week_index(7) == 0
    assert edl.week_index(8) == 1
    assert edl.week_index(357) == 50
    assert edl.week_index(358) == 51
    assert edl.week_index(365) == 51
    assert edl.week_index(366) == 51
    assert edl.week_of(date(2024, 1, 1)) == 0
    assert edl.week_of(date(2024, 12, 31)) == 51
    for bad in (0, 367, True):
        try:
            edl.week_index(bad)  # type: ignore[arg-type]
        except ValueError:
            pass
        else:
            raise AssertionError(f"expected ValueError for {bad}")

    from app.features import config as C
    import numpy as np

    doy = np.arange(1, 367)
    expected = np.minimum((doy - 1) // 7, C.WEEKS - 1)
    assert [edl.week_index(int(day)) for day in doy] == expected.tolist()


def test_data_hrefs_keep_granule_files_only():
    entry = {
        "links": [
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
                "href": EARTH,
            },
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/s3#",
                "href": "s3://lp-prod-protected/HLSL30.020/tile/file.tif",
            },
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
                "href": "https://search.earthdata.nasa.gov/search/granules",
            },
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/data#",
                "href": "https://appeears.earthdatacloud.nasa.gov/",
            },
            {
                "rel": "http://esipfed.org/ns/fedsearch/1.1/metadata#",
                "href": "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/tile/file.cmr.xml",
            },
        ]
    }
    assert edl.data_hrefs(entry) == [EARTH]
    assert edl._entries({"feed": {"entry": entry}}) == [entry]


def test_search_granules_pages_until_hits():
    pages = {
        "1": [{"id": "G1"}],
        "2": [{"id": "G2"}],
    }

    class Pages:
        def exchange(self, url, headers, sink=None):
            assert headers["Authorization"] == f"Bearer {TOKEN}"
            page = parse_qs(urlparse(url).query)["page_num"][0]
            body = json.dumps({"feed": {"entry": pages[page]}}).encode()
            return edl.HttpResult(200, {"CMR-Hits": "2"}, body, len(body))

    entries = _client(Pages()).search_granules(
        short_name="HLSL30",
        version="2.0",
        start=date(2024, 6, 1),
        end=date(2024, 6, 2),
        point=(-123.238, 49.2517),
        page_size=1,
    )
    assert [item["id"] for item in entries] == ["G1", "G2"]


def test_cached_ranged_download_and_concurrency(tmp_path):
    calls = {"n": 0}

    class Once:
        def exchange(self, url, headers, sink=None):
            calls["n"] += 1
            assert headers["Range"] == "bytes=0-3"
            assert headers["Authorization"] == f"Bearer {TOKEN}"
            assert TOKEN not in url
            sink.write(b"abcd")
            return edl.HttpResult(206, {}, b"", 4)

    client = edl.EarthdataClient(TOKEN, transport=Once(), cache_dir=tmp_path, sleep=lambda _s: None)
    dest = client.download_cached(EARTH, range_bytes=(0, 3))
    again = client.download_cached(EARTH, range_bytes=(0, 3))
    assert again == dest
    assert dest.read_bytes() == b"abcd"
    assert calls["n"] == 1
    assert TOKEN not in str(dest)
    assert dest.parent.parent == tmp_path

    current = 0
    peak = 0
    lock = threading.Lock()

    class Slow:
        def exchange(self, url, headers, sink=None):
            nonlocal current, peak
            with lock:
                current += 1
                peak = max(peak, current)
            time.sleep(0.05)
            with lock:
                current -= 1
            return edl.HttpResult(200, {}, b"x", 1)

    limited = edl.EarthdataClient(TOKEN, transport=Slow(), max_concurrent=2, sleep=lambda _s: None)
    bodies = limited.get_all([f"https://cmr.earthdata.nasa.gov/g/{i}" for i in range(6)])
    assert bodies == [b"x"] * 6
    assert peak == 2


def test_env_file_does_not_override_or_print(tmp_path, capsys):
    path = tmp_path / ".env"
    path.write_text(
        "\n".join([
            "# comment",
            f"EARTHDATA_TOKEN={TOKEN}",
            "OTHER=from-file",
            "export KEPT=nope",
            "export QUOTED='yes'",
        ]) + "\n",
        encoding="utf-8",
    )
    env = {"KEPT": "already"}
    assert edl.load_env_file(path, env) is True
    assert env["EARTHDATA_TOKEN"] == TOKEN
    assert env["OTHER"] == "from-file"
    assert env["KEPT"] == "already"
    assert env["QUOTED"] == "yes"
    assert edl.read_token(environ=env) == TOKEN
    assert capsys.readouterr().out == ""
    assert edl.load_env_file(tmp_path / "missing.env", {}) is False


def test_cli_skips_unknown_sites_and_reports_a_missing_token(monkeypatch, capsys):
    monkeypatch.delenv("EARTHDATA_TOKEN", raising=False)
    monkeypatch.setattr(edl, "ENV_FILE", Path("/no/such/fieldtwin.env"))
    code = edl.main(["--sites", "site_ubc_farm", "site_not_registered_yet", "--check-token"])
    captured = capsys.readouterr()
    assert code == 2
    assert "site site_ubc_farm" in captured.out
    assert "skip site_not_registered_yet: not registered in CURATED_SITES" in captured.out
    assert "EARTHDATA_TOKEN" in captured.err
    assert TOKEN not in captured.out
    assert TOKEN not in captured.err

    selected, skipped = edl.select_sites(None)
    assert "site_ubc_farm" in selected
    assert "site_usda_barc" in selected
    assert skipped == []


def test_urllib_transport_returns_redirects_without_following():
    seen: list[tuple[str, str | None, str | None]] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            seen.append((self.path, self.headers.get("Authorization"), self.headers.get("Range")))
            if self.path == "/denied":
                self.send_response(401)
                self.end_headers()
                return
            self.send_response(302)
            self.send_header("Location", "/secret-second")
            self.end_headers()

        def log_message(self, fmt, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        port = server.server_address[1]
        transport = edl.UrllibTransport(timeout_s=5)
        redirected = transport.exchange(
            f"http://127.0.0.1:{port}/start",
            {"Authorization": f"Bearer {TOKEN}", "Range": "bytes=0-3"},
        )
        denied = transport.exchange(f"http://127.0.0.1:{port}/denied", {})
    finally:
        server.shutdown()
        thread.join(timeout=2)
    assert redirected.status == 302
    assert edl._header(redirected.headers, "Location") == "/secret-second"
    assert denied.status == 401
    assert seen == [("/start", f"Bearer {TOKEN}", "bytes=0-3"), ("/denied", None, None)]
