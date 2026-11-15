"""Record that NEX-GDDP-CMIP6 was not extracted.

Decision D2 is in docs/progress/FT-W3.md. This script does not download a file
and does not write under data/seed. The climate outlook stays on history_resample.
"""

from __future__ import annotations

import sys


def main() -> int:
    print("NEX-GDDP-CMIP6 was not extracted. climate_source stays history_resample.")
    print("Reason: daily pr, tasmax and tasmin exist and the grid covers UBC Farm,")
    print("but the license statements disagree. See docs/progress/FT-W3.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
