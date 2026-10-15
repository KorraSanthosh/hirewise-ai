"""Candidate profile photos, stored as files (uploads/photos/<candidate row id>.<ext>) so the database schema stays untouched."""
import re
from pathlib import Path
from typing import Optional, Tuple

from app.core.config import settings
from app.core.errors import ValidationError

MAX_BYTES = 2 * 1024 * 1024
EXTS = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
_SAFE = re.compile(r"^[A-Za-z0-9_-]{6,64}$")


def _dir() -> Path:
    d = Path(settings.UPLOAD_DIR) / "photos"
    d.mkdir(parents=True, exist_ok=True)
    return d


def detect_type(data: bytes) -> Optional[str]:
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def find_photo(cand_id: str) -> Optional[Tuple[Path, str]]:
    if not _SAFE.match(cand_id or ""):
        return None
    for ext, mime in EXTS.items():
        f = _dir() / f"{cand_id}.{ext}"
        if f.is_file():
            return f, mime
    return None


def photo_url(cand_id: str) -> Optional[str]:
    found = find_photo(cand_id)
    return f"/api/candidates/{cand_id}/photo?v={int(found[0].stat().st_mtime)}" if found else None


def save_photo(cand_id: str, data: bytes) -> str:
    if not data:
        raise ValidationError("No image received.")
    if len(data) > MAX_BYTES:
        raise ValidationError("Photo is too large (max 2 MB).")
    ext = detect_type(data)
    if not ext:
        raise ValidationError("Photo must be a JPG, PNG or WebP image.")
    delete_photo(cand_id)
    (_dir() / f"{cand_id}.{ext}").write_bytes(data)
    return photo_url(cand_id) or ""


def delete_photo(cand_id: str) -> None:
    found = find_photo(cand_id)
    while found:
        found[0].unlink(missing_ok=True)
        found = find_photo(cand_id)
