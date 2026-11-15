"""Run the local API and the public Next.js listener in one container."""

import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "services" / "api"
WEB = ROOT / "apps" / "web"


def main() -> int:
    stopping = False

    def stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    children = []
    try:
        children.append(subprocess.Popen(
            [str(API / ".venv" / "bin" / "python"), "-m", "uvicorn", "app.main:app",
             "--host", "127.0.0.1", "--port", "8000"],
            cwd=API,
        ))
        children.append(subprocess.Popen(
            ["node", "node_modules/next/dist/bin/next", "start",
             "--hostname", "0.0.0.0", "--port", os.environ.get("PORT", "10000")],
            cwd=WEB,
        ))
        while not stopping:
            for child in children:
                if child.poll() is not None:
                    return child.returncode or 1
            time.sleep(0.25)
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == "__main__":
    raise SystemExit(main())
