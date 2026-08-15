"""Image upload handling for staff portfolios and venue photos.

Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is configured (any real
deployment on Vercel needs this -- the filesystem there is read-only
at runtime, so local disk storage silently breaks). Falls back to
local disk under uploads/ for local dev, where writable disk is free
and simpler than requiring every contributor to have a Blob token.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 8 * 1024 * 1024  # 8MB


def is_blob_configured() -> bool:
    return bool(settings.blob_read_write_token)


async def save_image(file: UploadFile, subdir: str) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or 'unknown'}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")

    filename = f"{uuid.uuid4().hex}{ext}"
    path = f"{subdir}/{filename}"

    if is_blob_configured():
        from vercel.blob import put_async

        result = await put_async(
            path,
            contents,
            access="public",
            content_type=file.content_type,
            token=settings.blob_read_write_token,
        )
        return result.url

    target_dir = UPLOAD_ROOT / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / filename).write_bytes(contents)
    return f"/uploads/{path}"


def delete_image(image_path: str) -> None:
    """Best-effort cleanup -- if the file/blob is already gone, that's fine."""
    if image_path.startswith(("http://", "https://")):
        if not is_blob_configured():
            return
        from vercel.blob import delete

        try:
            delete(image_path, token=settings.blob_read_write_token)
        except Exception:
            pass
        return

    if not image_path.startswith("/uploads/"):
        return
    full_path = UPLOAD_ROOT / image_path.removeprefix("/uploads/")
    full_path.unlink(missing_ok=True)
