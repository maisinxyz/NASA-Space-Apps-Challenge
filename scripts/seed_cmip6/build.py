"""Check NEX-GDDP-CMIP6 before writing cmip6_delta seeds. Writes nothing while the licence disagrees.

AWS Open Data registry, read 2026-11-15: as of September 2022 the outputs are CC0.
https://registry.opendata.aws/nex-gddp-cmip6/

NEX-GDDP-CMIP6 v2 tech note, June 2025, section 7: derivatives follow the CMIP6
terms, and each file's ``cmip6_license`` attribute may restrict use.
https://www.nccs.nasa.gov/wp-content/uploads/2025/06/NEX-GDDP-CMIP6-v2-Tech_Note.pdf
https://pcmdi.llnl.gov/CMIP6/TermsOfUse/TermsOfUse6-1.html

Daily ``pr``, ``tasmax``, and ``tasmin`` are the variables named in that tech note.
This script does not read EARTHDATA_TOKEN and does not write ``data/seed``.
"""

from __future__ import annotations

import sys

# Public bucket named by the AWS registry. No token.
BUCKET_URL = "https://nex-gddp-cmip6.s3.us-west-2.amazonaws.com/"

REGISTRY_CC0 = (
    "As of September 2022, all NEX-GDDP-CMIP6 outputs are made available under a "
    "blanket Creative Commons Zero license (CC0)."
)
TECH_NOTE_PER_FILE = (
    "The June 2025 tech note says each file's cmip6_license attribute may restrict use. "
    "A published open of one historical file showed cmip6_license: CC-BY-SA 4.0."
)


def licence_is_single_public_grant(statements: list[str]) -> bool:
    """True only when every statement is a CC0 grant and none names another licence."""

    if not statements:
        return False
    blob = " ".join(statements).lower()
    restricted = ("cc-by", "cc by", "by-sa", "sharealike", "share-alike", "noncommercial", "may restrict")
    if any(phrase in blob for phrase in restricted):
        return False
    return "cc0" in blob or "creative commons zero" in blob


def main() -> int:
    statements = [REGISTRY_CC0, TECH_NOTE_PER_FILE]
    if not licence_is_single_public_grant(statements):
        print(
            "cmip6_delta was not written. The AWS registry says CC0 and the June 2025 "
            "tech note still allows a per-file cmip6_license. No seed was stored.",
            file=sys.stderr,
        )
        return 2
    print("Licence is a single public grant. This build does not download until that path is implemented.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
