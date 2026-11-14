"""Tests for BE-02 image upload validation and sanitization."""

import io

import pytest
from PIL import Image

from app.core.errors import ApiError
from app.imagery.uploads import MAX_FILE_BYTES, validate_and_store


def make_image(fmt="JPEG", size=(40, 30), exif=None):
    image = Image.new("RGB", size, "red")
    output = io.BytesIO()
    kwargs = {"exif": exif} if exif is not None else {}
    image.save(output, format=fmt, **kwargs)
    return output.getvalue()


def test_valid_jpeg(tmp_path):
    result = validate_and_store(make_image(), tmp_path)

    assert result.path.exists()
    assert result.path.name == f"{result.sha256}.jpg"
    assert result.original_format == "JPEG"
    assert (result.width, result.height) == (40, 30)


def test_png_content_accepted_regardless_of_filename(tmp_path):
    # The validator accepts bytes, not a filename.
    # This simulates PNG content uploaded with a misleading .jpg extension.
    result = validate_and_store(make_image("PNG"), tmp_path)

    assert result.original_format == "PNG"

    with Image.open(result.path) as image:
        assert image.format == "JPEG"


def test_text_disguised_as_jpeg_rejected(tmp_path):
    with pytest.raises(ApiError) as exc:
        validate_and_store(b"not actually an image", tmp_path)

    assert exc.value.code == "UNSUPPORTED_FILE"


def test_oversized_file_rejected(tmp_path):
    with pytest.raises(ApiError) as exc:
        validate_and_store(b"x" * (MAX_FILE_BYTES + 1), tmp_path)

    assert exc.value.code == "FILE_TOO_LARGE"


def test_exif_stripped_and_orientation_applied(tmp_path):
    exif = Image.Exif()
    exif[274] = 6  # Rotate 90 degrees clockwise for display.
    exif[305] = "Private device information"

    result = validate_and_store(make_image(exif=exif), tmp_path)

    assert result.orientation == 6

    with Image.open(result.path) as image:
        assert image.size == (30, 40)
        assert not image.getexif()


def test_identical_uploads_share_content_hash(tmp_path):
    content = make_image()

    first = validate_and_store(content, tmp_path)
    second = validate_and_store(content, tmp_path)

    assert first.sha256 == second.sha256
    assert first.path == second.path


def test_empty_file_rejected(tmp_path):
    with pytest.raises(ApiError) as exc:
        validate_and_store(b"", tmp_path)

    assert exc.value.code == "INVALID_INPUT"


def test_pixel_dimension_limit(tmp_path, monkeypatch):
    from app.imagery import uploads

    monkeypatch.setattr(uploads, "MAX_IMAGE_PIXELS", 1000)

    with pytest.raises(ApiError) as exc:
        validate_and_store(make_image(size=(40, 30)), tmp_path)

    assert exc.value.code == "INVALID_INPUT"
    assert not list(tmp_path.iterdir())


def test_gps_extracted_but_stripped_from_saved_image(tmp_path):
    exif = Image.Exif()
    exif[34853] = {
        1: "N",
        2: (49.0, 15.0, 0.0),
        3: "W",
        4: (123.0, 7.0, 0.0),
    }

    result = validate_and_store(make_image(exif=exif), tmp_path)

    assert result.gps is not None
    assert result.gps[1] == "N"
    assert result.gps[3] == "W"

    with Image.open(result.path) as image:
        assert not image.getexif()
