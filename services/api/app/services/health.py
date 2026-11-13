from app.core.config import API_VERSION, Settings


def health(settings: Settings) -> dict:
    return {"status": "ok", "mode": "offline" if settings.offline else "live", "version": API_VERSION}
