"""Validate and sanitize farmer-uploaded images (BE-02, Prompt 34).

Uploaded photos stay on the local server. Original EXIF metadata is never
written to the sanitized image. Limits below are provisional until agreed
with the scan-interface owner.
"""

from __future__ import annotations

import hashlib
import io
import warnings
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import ApiError

MAX_IMAGES = 6
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


@dataclass(frozen=True)
class StoredImage:
    path: Path
    sha256: str
    width: int
    height: int
    original_format: str
    orientation: int | None
    gps: dict | None


def validate_and_store(
    content: bytes,
    storage_dir: Path,
    expected_format: str | None = None,
) -> StoredImage:
    """Validate an image and save a metadata-free JPEG copy."""

    if len(content) > MAX_FILE_BYTES:
        raise ApiError(
            "FILE_TOO_LARGE",
            "Image exceeds the 10 MiB upload limit.",
            "Choose a smaller photo.",
        )

    if not content:
        raise ApiError("INVALID_INPUT", "Image is empty.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as probe:
                original_format = probe.format
    
                if original_format not in ALLOWED_FORMATS:
                    raise ApiError(
                        "UNSUPPORTED_FILE",
                        "Only JPEG, PNG and WebP images are supported.",
                    )
    
                width, height = probe.size
    
                if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                    raise ApiError(
                        "INVALID_INPUT",
                        "Image dimensions exceed the supported limit.",
                    )
    
                probe.verify()
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as image:
                exif = image.getexif()
                orientation = exif.get(274)

                gps = None
                try:
                    gps_data = exif.get_ifd(34853)
                    if gps_data:
                        gps = dict(gps_data)
                except (KeyError, TypeError, ValueError):
                    pass

                image.load()
                image = ImageOps.exif_transpose(image)
                width, height = image.size
                rgb = Image.new("RGB", image.size, (255, 255, 255))

                if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                    rgba = image.convert("RGBA")
                    rgb.paste(rgba, mask=rgba.getchannel("A"))
                else:
                    rgb.paste(image.convert("RGB"))

                output = io.BytesIO()
                rgb.save(output, format="JPEG", quality=90)
                sanitized = output.getvalue()

    except ApiError:
        raise
    except Image.DecompressionBombWarning as exc:
        raise ApiError(
            "INVALID_INPUT",
            "Image dimensions exceed the supported limit.",
            "Choose a smaller image.",
        ) from exc
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise ApiError(
            "UNSUPPORTED_FILE",
            "The uploaded file is not a valid supported image.",
            "Choose a valid JPEG, PNG or WebP photo.",
        ) from exc

    if expected_format and original_format != expected_format:
        raise ApiError(
            "UNSUPPORTED_FILE",
            "Image content does not match its declared media type.",
        )

    digest = hashlib.sha256(sanitized).hexdigest()
    storage_dir = Path(storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    destination = storage_dir / f"{digest}.jpg"

    import tempfile

    if destination.is_symlink():
        raise ApiError("INTERNAL", "Unsafe upload storage destination.")

    if not destination.exists():
        with tempfile.NamedTemporaryFile(
            dir=storage_dir,
            prefix=".upload-",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(sanitized)
            temporary_path = Path(temporary.name)

        try:
            temporary_path.replace(destination)
        finally:
            temporary_path.unlink(missing_ok=True)

    return StoredImage(
        path=destination,
        sha256=digest,
        width=width,
        height=height,
        original_format=original_format,
        orientation=orientation,
        gps=gps,
    )
