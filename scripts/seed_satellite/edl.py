"""NASA Earthdata download core for seed builds. No product files are written here.

The token is read from ``EARTHDATA_TOKEN`` (optional repo-root ``.env`` if the
variable is unset). It is sent only as ``Authorization: Bearer`` to NASA
Earthdata hosts, and it is re-added when a redirect stays on an Earthdata host.
Redirects to any other host (a signed object-store URL, for example) do not
receive the header. The token is never logged, printed, or written to disk.

CMR granule search parameters and the JSON result extension are the public
search API documented at
https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html
(read 2026-11-15). ``page_size`` max on that page is 2000. A public
``HLSL30`` v2.0 granule response the same day used ``links[].rel`` ending in
``/data#`` (``http://esipfed.org/ns/fedsearch/1.1/data#``) for HTTPS files on
``data.lpdaac.earthdatacloud.nasa.gov``.

Week index matches ``app.features.pipeline``: 7-day blocks from 1 January,
``min((doy - 1) // 7, 51)``, so days 358-366 fold into week 51.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import threading
from collections.abc import Callable, Mapping, MutableMapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import BinaryIO
from urllib.error import URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import HTTPErrorProcessor, Request, build_opener

ROOT = Path(__file__).resolve().parents[2]
API_ROOT = ROOT / "services" / "api"
CACHE_DIR = ROOT / "data" / "cache" / "earthdata"
ENV_FILE = ROOT / ".env"

# Documented CMR search collection/granule host. The ``.json`` extension
# selects ``application/json`` (same page as the collections search FT-W2 used).
CMR_GRANULE_SEARCH = "https://cmr.earthdata.nasa.gov/search/granules.json"
# https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html
# "Client-Id - Indicates a name for the client using the CMR API."
CLIENT_ID = "fieldtwin-seed"
# Assumed politeness cap. Not a published per-product quota.
# CMR does document HTTP 429 plus a retry-after header on that same page.
DEFAULT_MAX_CONCURRENT = 2
DEFAULT_MAX_RETRIES = 4
DEFAULT_BACKOFF_S = 1.0
# Assumed ceiling so a non-numeric or huge Retry-After cannot stall a seed build.
MAX_RETRY_AFTER_S = 60.0
MAX_REDIRECTS = 10
WEEKS = 52
REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
AUTH_STATUSES = frozenset({401, 403})
SUCCESS_STATUSES = frozenset({200, 206})

# Hosts that CMR tags ``data#`` but that are portals, not granule files.
# Observed on the public HLSL30 granule fetched 2026-11-15.
_PORTAL_HOSTS = frozenset({
    "search.earthdata.nasa.gov",
    "appeears.earthdatacloud.nasa.gov",
})


class MissingEarthdataToken(RuntimeError):
    """``EARTHDATA_TOKEN`` is unset. The message never contains a token value."""


class EarthdataError(RuntimeError):
    """A download or search failed. The message never contains a token value."""


class EarthdataRejected(EarthdataError):
    """Earthdata returned 401 or 403. The token is not included."""


class TransportFailure(EarthdataError):
    """The HTTP exchange failed before a status code arrived."""


def is_earthdata_host(host: str | None) -> bool:
    """True for NASA Earthdata and Earthdata Cloud hosts only."""
    if not host:
        return False
    name = host.lower().rstrip(".")
    if name in ("earthdata.nasa.gov", "earthdatacloud.nasa.gov"):
        return True
    return name.endswith(".earthdata.nasa.gov") or name.endswith(".earthdatacloud.nasa.gov")


def load_env_file(path: Path, environ: MutableMapping[str, str] | None = None) -> bool:
    """Fill unset keys from a ``KEY=VALUE`` file. A missing file is ignored.

    Existing non-empty values are left as they are. Nothing is printed.
    """
    if not path.is_file():
        return False
    target = os.environ if environ is None else environ
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key.replace("_", "").isalnum():
            continue
        if str(target.get(key, "")).strip():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        target[key] = value
    return True


def read_token(environ: Mapping[str, str] | None = None, env_file: Path | None = None) -> str:
    """Return the Earthdata token, or raise ``MissingEarthdataToken``.

    When ``environ`` is omitted, an optional ``.env`` is loaded first and the
    process environment is used. The returned string is for the Authorization
    header only. Callers must not print it.
    """
    if environ is None:
        load_env_file(ENV_FILE if env_file is None else env_file)
        environ = os.environ
    token = str(environ.get("EARTHDATA_TOKEN", "")).strip()
    if not token:
        raise MissingEarthdataToken(
            "EARTHDATA_TOKEN is not set. Seed downloads need it in the environment. "
            "The token value is not printed."
        )
    return token


def _num(value: float) -> str:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise ValueError("coordinate must be a finite number")
    return format(float(value), ".10g")


def _cmr_time(value: date | datetime, *, end: bool) -> str:
    """UTC instant for a CMR temporal bound.

    A plain ``date`` is the start of that UTC day, or 23:59:59Z when ``end``
    so the end day is included. CMR's own examples use ``T23:59:59Z`` as an
    end bound (same API page).
    """
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(value, date):
        clock = "23:59:59" if end else "00:00:00"
        return f"{value.isoformat()}T{clock}Z"
    raise TypeError("start and end must be dates")


def granule_search_url(
    *,
    short_name: str,
    version: str,
    start: date | datetime,
    end: date | datetime,
    point: tuple[float, float] | None = None,
    bounding_box: tuple[float, float, float, float] | None = None,
    page_size: int = 200,
    page_num: int = 1,
) -> str:
    """Build a CMR granule search URL. No request is made.

    ``point`` is ``(longitude, latitude)``. ``bounding_box`` is
    ``(west, south, east, north)``: lower-left longitude, lower-left latitude,
    upper-right longitude, upper-right latitude, as the API page states.
    Pass one of the two spatial filters, not both.
    """
    if not str(short_name).strip() or not str(version).strip():
        raise ValueError("short_name and version are required")
    if point is not None and bounding_box is not None:
        raise ValueError("pass point or bounding_box, not both")
    if not 1 <= int(page_size) <= 2000:
        raise ValueError("page_size must be from 1 to 2000")
    if int(page_num) < 1:
        raise ValueError("page_num must be at least 1")
    start_at = _cmr_time(start, end=False)
    end_at = _cmr_time(end, end=True)
    if start_at > end_at:
        raise ValueError("start must be on or before end")
    params: dict[str, str] = {
        "short_name": str(short_name).strip(),
        "version": str(version).strip(),
        "temporal": f"{start_at},{end_at}",
        "page_size": str(int(page_size)),
        "page_num": str(int(page_num)),
    }
    if point is not None:
        lon, lat = point
        lon_s, lat_s = _num(lon), _num(lat)
        if not -180 <= float(lon_s) <= 180 or not -90 <= float(lat_s) <= 90:
            raise ValueError("point is outside longitude -180..180 and latitude -90..90")
        params["point"] = f"{lon_s},{lat_s}"
    if bounding_box is not None:
        west, south, east, north = bounding_box
        parts = [_num(west), _num(south), _num(east), _num(north)]
        if not -90 <= float(parts[1]) <= float(parts[3]) <= 90:
            raise ValueError("bounding_box latitudes must run south to north inside -90..90")
        if not all(-180 <= float(item) <= 180 for item in (parts[0], parts[2])):
            raise ValueError("bounding_box longitudes must be inside -180..180")
        params["bounding_box"] = ",".join(parts)
    return CMR_GRANULE_SEARCH + "?" + urlencode(params)


def _entries(document: dict) -> list[dict]:
    """CMR JSON ``feed.entry``. A public response on 2026-11-15 used a list."""
    entry = document.get("feed", {}).get("entry", [])
    if isinstance(entry, dict):
        return [entry]
    if isinstance(entry, list):
        return [item for item in entry if isinstance(item, dict)]
    return []


def data_hrefs(entry: Mapping) -> list[str]:
    """HTTPS granule-file links from one CMR JSON entry.

    Keeps ``rel`` ending in ``/data#`` on an Earthdata host whose last path
    segment looks like a filename. That drops the collection-level portal
    links (Earthdata Search, AppEEARS) that the same granule also tags
    ``data#``, and it drops ``s3://`` links (a different rel, ``s3#``).
    """
    found: list[str] = []
    for link in entry.get("links") or []:
        if not isinstance(link, Mapping):
            continue
        rel = str(link.get("rel") or "")
        href = str(link.get("href") or "")
        if not rel.endswith("/data#") or not href:
            continue
        parts = urlparse(href)
        if parts.scheme != "https" or not is_earthdata_host(parts.hostname):
            continue
        host = (parts.hostname or "").lower()
        if host in _PORTAL_HOSTS:
            continue
        name = Path(parts.path).name
        if "." not in name:
            continue
        found.append(href)
    return found


def week_index(doy: int) -> int:
    """0-based week. Days 358-366 share week 51. ``doy`` is 1-based."""
    if isinstance(doy, bool) or not isinstance(doy, int) or not 1 <= doy <= 366:
        raise ValueError("day of year must be an integer from 1 to 366")
    return min((doy - 1) // 7, WEEKS - 1)


def day_of_year(when: date) -> int:
    return (when - date(when.year, 1, 1)).days + 1


def week_of(when: date) -> int:
    return week_index(day_of_year(when))


def request_headers(url: str, token: str, extra: Mapping[str, str] | None = None) -> dict[str, str]:
    """Headers for one hop. Authorization is attached only on Earthdata hosts."""
    if token and token in url:
        raise EarthdataError("refusing a URL that contains the Earthdata token")
    parts = urlparse(url)
    if parts.username or parts.password:
        raise EarthdataError("refusing a URL that embeds credentials")
    if parts.scheme not in {"http", "https"}:
        raise EarthdataError("refusing a URL that is not http or https")
    headers: dict[str, str] = {}
    for key, value in (extra or {}).items():
        if key.lower() == "authorization":
            continue
        headers[key] = value
    if parts.scheme == "https" and is_earthdata_host(parts.hostname):
        headers.setdefault("Client-Id", CLIENT_ID)
        headers["Authorization"] = f"Bearer {token}"
    return headers


def cache_path(cache_dir: Path, url: str, range_bytes: tuple[int, int] | None = None) -> Path:
    """Deterministic cache path. The token is not an input and cannot appear."""
    parts = urlparse(url)
    host = parts.hostname or "unknown-host"
    host = "".join(ch if ch.isalnum() or ch in ".-" else "_" for ch in host)
    name = Path(parts.path).name or "object"
    name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)[:80]
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    if range_bytes is None:
        filename = f"{digest}-{name}"
    else:
        start, end = range_bytes
        filename = f"{digest}-{start}-{end}-{name}"
    return cache_dir / host / filename


def _header(headers: Mapping[str, str], name: str) -> str | None:
    for key, value in headers.items():
        if key.lower() == name.lower():
            return value
    return None


def _hostname(url: str) -> str:
    return urlparse(url).hostname or "unknown-host"


@dataclass
class HttpResult:
    status: int
    headers: dict[str, str]
    body: bytes
    nbytes: int


class UrllibTransport:
    """One HTTP GET. Redirects are not followed; the caller re-adds auth."""

    def __init__(self, timeout_s: float = 120.0):
        self.timeout_s = timeout_s
        processor = _NoFollow()
        self._opener = build_opener(processor)

    def exchange(self, url: str, headers: Mapping[str, str], sink: BinaryIO | None = None) -> HttpResult:
        req = Request(url, method="GET")
        for key, value in headers.items():
            req.add_header(key, value)
        try:
            with self._opener.open(req, timeout=self.timeout_s) as resp:
                status = getattr(resp, "status", None) or resp.getcode()
                hdrs = {key: value for key, value in resp.headers.items()}
                if sink is not None and status in SUCCESS_STATUSES:
                    nbytes = 0
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        sink.write(chunk)
                        nbytes += len(chunk)
                    return HttpResult(status, hdrs, b"", nbytes)
                body = resp.read()
                return HttpResult(status, hdrs, body, len(body))
        except URLError as exc:
            reason = getattr(exc, "reason", exc)
            raise TransportFailure(f"request failed for host {_hostname(url)}: {reason}") from None


class _NoFollow(HTTPErrorProcessor):
    """Return 3xx and 4xx responses instead of following or raising."""

    # Lower than urllib's default processor (1000) so this one runs first.
    handler_order = 0

    def http_response(self, request, response):
        return response

    https_response = http_response


class EarthdataClient:
    """Search and download helper. ``token`` is kept off ``repr`` and errors."""

    def __init__(
        self,
        token: str,
        *,
        transport: object | None = None,
        max_concurrent: int = DEFAULT_MAX_CONCURRENT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_s: float = DEFAULT_BACKOFF_S,
        max_redirects: int = MAX_REDIRECTS,
        sleep: Callable[[float], None] | None = None,
        cache_dir: Path = CACHE_DIR,
    ):
        if not str(token).strip():
            raise MissingEarthdataToken(
                "EARTHDATA_TOKEN is not set. Seed downloads need it in the environment. "
                "The token value is not printed."
            )
        if max_concurrent < 1:
            raise ValueError("max_concurrent must be at least 1")
        if max_retries < 1:
            raise ValueError("max_retries must be at least 1")
        self._token = str(token).strip()
        self.transport = transport if transport is not None else UrllibTransport()
        self.max_concurrent = max_concurrent
        self.max_retries = max_retries
        self.backoff_s = backoff_s
        self.max_redirects = max_redirects
        self._sleep = sleep if sleep is not None else _sleep
        self.cache_dir = cache_dir
        self._sem = threading.BoundedSemaphore(max_concurrent)

    def __repr__(self) -> str:
        return f"EarthdataClient(max_concurrent={self.max_concurrent})"

    def _delay(self, attempt: int, headers: Mapping[str, str] | None) -> float:
        if headers:
            raw = _header(headers, "Retry-After")
            if raw:
                try:
                    return min(float(raw), MAX_RETRY_AFTER_S)
                except ValueError:
                    pass
        return self.backoff_s * (2 ** attempt)

    def _exchange(self, url: str, headers: Mapping[str, str], sink: BinaryIO | None) -> HttpResult:
        last: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                with self._sem:
                    result = self.transport.exchange(url, headers, sink)  # type: ignore[attr-defined]
            except TransportFailure as exc:
                last = exc
                if attempt + 1 == self.max_retries:
                    break
                self._sleep(self._delay(attempt, None))
                _rewind(sink)
                continue
            if result.status in RETRY_STATUSES and attempt + 1 < self.max_retries:
                self._sleep(self._delay(attempt, result.headers))
                _rewind(sink)
                continue
            return result
        raise EarthdataError(f"NASA Earthdata request failed for host {_hostname(url)}") from None if last is None else last

    def request(
        self,
        url: str,
        *,
        extra: Mapping[str, str] | None = None,
        sink: BinaryIO | None = None,
    ) -> HttpResult:
        """GET ``url``, following redirects and re-adding the bearer token."""
        current = url
        for _hop in range(self.max_redirects + 1):
            headers = request_headers(current, self._token, extra)
            result = self._exchange(current, headers, sink)
            if result.status in REDIRECT_STATUSES:
                location = _header(result.headers, "Location")
                if not location:
                    raise EarthdataError(f"redirect from {_hostname(current)} had no Location header")
                current = urljoin(current, location.strip())
                _rewind(sink)
                continue
            if result.status in AUTH_STATUSES:
                raise EarthdataRejected(
                    f"NASA Earthdata rejected the request (HTTP {result.status}) for host {_hostname(current)}. "
                    "The token was not printed."
                )
            if result.status not in SUCCESS_STATUSES:
                raise EarthdataError(f"NASA Earthdata returned HTTP {result.status} for host {_hostname(current)}")
            return result
        raise EarthdataError(f"stopped after {self.max_redirects} redirects from {_hostname(url)}")

    def resolve(self, url: str, *, cap: int = 4096) -> str:
        """Follow redirects and return the URL that served the object.

        A one-byte range is requested. If the final host ignores ``Range`` and
        starts sending the object, reading stops after ``cap`` bytes and that
        URL is still returned. The bearer token is attached only on Earthdata
        hosts, including redirect hops, and it is never written into the result.
        """
        if cap < 1:
            raise ValueError("cap must be at least 1")
        current = url
        for _hop in range(self.max_redirects + 1):
            headers = request_headers(current, self._token, {"Range": "bytes=0-0"})
            sink = _CapSink(cap)
            try:
                result = self._exchange(current, headers, sink)
            except _BodyCap:
                return current
            if result.status in REDIRECT_STATUSES:
                location = _header(result.headers, "Location")
                if not location:
                    raise EarthdataError(f"redirect from {_hostname(current)} had no Location header")
                current = urljoin(current, location.strip())
                continue
            if result.status in AUTH_STATUSES:
                raise EarthdataRejected(
                    f"NASA Earthdata rejected the request (HTTP {result.status}) for host {_hostname(current)}. "
                    "The token was not printed."
                )
            if result.status not in SUCCESS_STATUSES:
                raise EarthdataError(f"NASA Earthdata returned HTTP {result.status} for host {_hostname(current)}")
            return current
        raise EarthdataError(f"stopped after {self.max_redirects} redirects from {_hostname(url)}")

    def get_bytes(self, url: str, *, extra: Mapping[str, str] | None = None) -> bytes:
        return self.request(url, extra=extra).body

    def get_all(self, urls: list[str]) -> list[bytes]:
        """Download many URLs. In-flight requests stay within the concurrency cap."""
        if not urls:
            return []
        results: list[bytes | None] = [None] * len(urls)
        with ThreadPoolExecutor(max_workers=len(urls)) as pool:
            futures = {pool.submit(self.get_bytes, url): index for index, url in enumerate(urls)}
            for future, index in futures.items():
                results[index] = future.result()
        return [item if item is not None else b"" for item in results]

    def search_granules(
        self,
        *,
        short_name: str,
        version: str,
        start: date | datetime,
        end: date | datetime,
        point: tuple[float, float] | None = None,
        bounding_box: tuple[float, float, float, float] | None = None,
        page_size: int = 200,
    ) -> list[dict]:
        """Every granule entry for one collection, point or bounding box, and range."""
        entries: list[dict] = []
        page = 1
        while True:
            url = granule_search_url(
                short_name=short_name,
                version=version,
                start=start,
                end=end,
                point=point,
                bounding_box=bounding_box,
                page_size=page_size,
                page_num=page,
            )
            result = self.request(url, extra={"Accept": "application/json"})
            try:
                document = json.loads(result.body.decode("utf-8"))
            except (UnicodeError, json.JSONDecodeError) as exc:
                raise EarthdataError(f"CMR returned a body that is not JSON from {_hostname(url)}") from exc
            if not isinstance(document, dict):
                raise EarthdataError("CMR JSON was not an object")
            batch = _entries(document)
            entries.extend(batch)
            hits = _header(result.headers, "CMR-Hits")
            if hits is not None and hits.strip().isdigit() and len(entries) >= int(hits):
                break
            if len(batch) < page_size:
                break
            page += 1
            if page > 10000:
                raise EarthdataError("CMR pagination did not end")
        return entries

    def download(
        self,
        url: str,
        dest: Path,
        *,
        range_bytes: tuple[int, int] | None = None,
    ) -> Path:
        """Full or ranged download. ``range_bytes`` is an inclusive byte range."""
        extra: dict[str, str] = {}
        if range_bytes is not None:
            start, end = range_bytes
            if isinstance(start, bool) or isinstance(end, bool):
                raise ValueError("byte range must be integers")
            if start < 0 or end < start:
                raise ValueError("byte range must be start <= end and start >= 0")
            extra["Range"] = f"bytes={start}-{end}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".part")
        try:
            with tmp.open("wb") as sink:
                self.request(url, extra=extra, sink=sink)
            tmp.replace(dest)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise
        return dest

    def download_cached(self, url: str, *, range_bytes: tuple[int, int] | None = None) -> Path:
        """Download into ``data/cache/earthdata/`` unless that file is already there."""
        dest = cache_path(self.cache_dir, url, range_bytes)
        if dest.is_file() and dest.stat().st_size > 0:
            return dest
        return self.download(url, dest, range_bytes=range_bytes)


def _sleep(seconds: float) -> None:
    import time
    time.sleep(seconds)


def _rewind(sink: BinaryIO | None) -> None:
    if sink is None:
        return
    sink.seek(0)
    sink.truncate()


class _BodyCap(Exception):
    """The range body was larger than the resolve cap. Not an error message."""


class _CapSink:
    """Accept a short body. Raise ``_BodyCap`` once ``limit`` bytes are passed."""

    def __init__(self, limit: int):
        self.limit = limit
        self.n = 0

    def write(self, data: bytes) -> int:
        self.n += len(data)
        if self.n > self.limit:
            raise _BodyCap()
        return len(data)

    def seek(self, offset: int, whence: int = 0) -> int:
        self.n = 0
        return 0

    def truncate(self, size: int | None = None) -> int:
        self.n = 0
        return 0


def _ensure_api_path() -> None:
    path = str(API_ROOT)
    if path not in sys.path:
        sys.path.insert(0, path)


def select_sites(requested: list[str] | None, sites: Mapping[str, dict] | None = None) -> tuple[list[str], list[str]]:
    """Curated site ids, plus ids that are not registered yet.

    ``requested`` of ``None`` means every curated site. An unknown id is
    skipped, not an error, so a site another session has not registered yet
    does not stop the run.
    """
    if sites is None:
        _ensure_api_path()
        from app.features.config import CURATED_SITES
        sites = CURATED_SITES
    if requested is None:
        return list(sites), []
    selected: list[str] = []
    skipped: list[str] = []
    for site_id in requested:
        if site_id in sites:
            selected.append(site_id)
        else:
            skipped.append(site_id)
    return selected, skipped


def main(argv: list[str] | None = None) -> int:
    """Resolve sites and, when asked, check that the token is present.

    EA1 does not download a product. Later workstreams call ``EarthdataClient``.
    """
    parser = argparse.ArgumentParser(description="Earthdata download core. Does not fetch a product.")
    parser.add_argument("--sites", nargs="*", default=None, help="Curated site ids. Unknown ids are skipped.")
    parser.add_argument("--check-token", action="store_true", help="Exit 2 when EARTHDATA_TOKEN is unset.")
    args = parser.parse_args(argv)
    selected, skipped = select_sites(args.sites)
    for site_id in skipped:
        print(f"skip {site_id}: not registered in CURATED_SITES")
    for site_id in selected:
        print(f"site {site_id}")
    if args.check_token:
        try:
            read_token()
        except MissingEarthdataToken as exc:
            print(str(exc), file=sys.stderr)
            return 2
        print("EARTHDATA_TOKEN is set")
    return 0


if __name__ == "__main__":
    sys.exit(main())
