import io
import re
import warnings
from pathlib import Path

from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from PIL import Image, ImageOps
from rest_framework.exceptions import ValidationError


MAX_BYTES = {"image": 10 * 1024 * 1024, "video": 50 * 1024 * 1024, "audio": 15 * 1024 * 1024}
Image.MAX_IMAGE_PIXELS = 20_000_000


def normalize_image(upload, extension):
    formats = {
        ".jpg": ("JPEG", "image/jpeg"), ".jpeg": ("JPEG", "image/jpeg"),
        ".png": ("PNG", "image/png"), ".webp": ("WEBP", "image/webp"),
        ".gif": ("GIF", "image/gif"),
    }
    expected = formats.get(extension)
    if not expected or upload.content_type != expected[1]:
        raise ValidationError({"file": "Choose a JPEG, PNG, WebP, or GIF image."})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(upload) as candidate:
                if candidate.format != expected[0]:
                    raise ValueError
                candidate.verify()
            upload.seek(0)
            with Image.open(upload) as candidate:
                frame_count = getattr(candidate, "n_frames", 1)
                if frame_count > 120 or candidate.width * candidate.height * frame_count > 60_000_000:
                    raise ValidationError({"file": "Animations are limited to 120 frames and 60 million decoded pixels."})
                frames = []
                durations = []
                for frame_index in range(frame_count):
                    candidate.seek(frame_index)
                    frame = ImageOps.exif_transpose(candidate).convert("RGBA")
                    frame.thumbnail((1200, 1200) if frame_count > 1 else (2200, 2200))
                    frames.append(frame)
                    durations.append(max(20, min(int(candidate.info.get("duration", 100)), 10000)))
                output = io.BytesIO()
                options = {"save_all": True, "append_images": frames[1:], "duration": durations, "loop": 0} if frame_count > 1 else {}
                frames[0].save(output, format="WEBP", quality=85, **options)
                still = None
                if frame_count > 1:
                    still_output = io.BytesIO()
                    frames[0].save(still_output, format="WEBP", quality=85)
                    still = ContentFile(still_output.getvalue(), name="still.webp")
        return ContentFile(output.getvalue(), name="photo.webp"), "image/webp", still
    except (OSError, ValueError, EOFError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValidationError({"file": "This image is invalid or too large to decode safely."}) from error


def validate_upload(upload, kind):
    if kind not in MAX_BYTES:
        raise ValidationError({"kind": "Choose image, video, or audio."})
    if upload.size == 0 or upload.size > MAX_BYTES[kind]:
        raise ValidationError({"file": f"The maximum {kind} size is {MAX_BYTES[kind] // (1024 * 1024)} MB."})
    extension = Path(upload.name).suffix.lower()
    header = upload.read(4096)
    upload.seek(0)
    if kind == "image":
        return normalize_image(upload, extension)
    formats = {
        ("video", ".mp4", "video/mp4"): (len(header) >= 12 and header[4:8] == b"ftyp"),
        ("video", ".webm", "video/webm"): (header.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in header),
        ("audio", ".mp3", "audio/mpeg"): (header.startswith(b"ID3") or len(header) >= 2 and header[0] == 255 and header[1] & 224 == 224),
        ("audio", ".wav", "audio/wav"): (header.startswith(b"RIFF") and header[8:12] == b"WAVE"),
        ("audio", ".wav", "audio/x-wav"): (header.startswith(b"RIFF") and header[8:12] == b"WAVE"),
        ("audio", ".ogg", "audio/ogg"): header.startswith(b"OggS"),
    }
    if len(header) < 16 or not formats.get((kind, extension, upload.content_type)):
        raise ValidationError({"file": "File contents, format, and media type do not match an allowed format."})
    upload.name = f"media{extension}"
    return upload, "audio/wav" if upload.content_type == "audio/x-wav" else upload.content_type, None


def private_file_response(request, asset, still=False):
    file = asset.still_file if still else asset.file
    mime_type = "image/webp" if still else asset.mime_type
    total = file.size
    range_header = request.headers.get("Range")
    if not range_header:
        response = FileResponse(file.open("rb"), content_type=mime_type)
    else:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header)
        try:
            if not match or not any(match.groups()):
                raise ValueError
            first, last = match.groups()
            start = int(first) if first else max(0, total - int(last))
            end = min(int(last), total - 1) if first and last else total - 1
            if start > end or start >= total or not first and int(last) == 0:
                raise ValueError
        except (ValueError, OverflowError):
            return HttpResponse(status=416, headers={"Content-Range": f"bytes */{total}", "Cache-Control": "private, no-store"})

        def chunks():
            with file.open("rb") as source:
                source.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = source.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        response = StreamingHttpResponse(chunks(), status=206, content_type=mime_type)
        response["Content-Range"] = f"bytes {start}-{end}/{total}"
        response["Content-Length"] = str(end - start + 1)
    response["Accept-Ranges"] = "bytes"
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response["Content-Disposition"] = 'inline; filename="private-media"'
    return response