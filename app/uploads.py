"""Local-disk image upload handling for staff portfolios and venue
photos. Fine for local dev; swap for S3 (or similar) before a real
deployment -- the storage boundary is this one module.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 8 * 1024 * 1024  # 8MB


async def save_image(file: UploadFile, subdir: str) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or 'unknown'}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")

    target_dir = UPLOAD_ROOT / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    (target_dir / filename).write_bytes(contents)

    return f"/uploads/{subdir}/{filename}"


def delete_image(image_path: str) -> None:
    """Best-effort disk cleanup -- if the file is already gone, that's fine."""
    if not image_path.startswith("/uploads/"):
        return
    full_path = UPLOAD_ROOT / image_path.removeprefix("/uploads/")
    full_path.unlink(missing_ok=True)
