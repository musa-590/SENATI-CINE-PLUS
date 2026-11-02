from __future__ import annotations

import os
import uuid
from pathlib import Path

from werkzeug.datastructures import FileStorage

VIDEO_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
}

IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

VIDEO_FOLDERS = "videos"
POSTER_FOLDERS = "posters"


def _extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def _sniff_video(stream, extension: str) -> bool:
    stream.seek(0)
    head = stream.read(16)
    stream.seek(0)
    if extension == ".webm":
        return head.startswith(b"\x1a\x45\xdf\xa3")
    if extension == ".mp4":
        return b"ftyp" in head[4:12] or b"ftyp" in head[:16]
    return False


def _sniff_image(stream, extension: str) -> bool:
    stream.seek(0)
    head = stream.read(16)
    stream.seek(0)
    if extension in {".jpg", ".jpeg"}:
        return head.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".webp":
        return head.startswith(b"RIFF") and head[8:12] == b"WEBP"
    return False


def save_video(file: FileStorage, upload_folder: str | Path) -> tuple[str, str]:
    filename = file.filename or ""
    extension = _extension(filename)
    if extension not in VIDEO_TYPES:
        raise ValueError("El tráiler debe ser un archivo .mp4 o .webm.")

    if not _sniff_video(file.stream, extension):
        raise ValueError("El archivo no parece un vídeo MP4/WebM válido.")

    target_dir = Path(upload_folder) / VIDEO_FOLDERS
    target_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    file.save(target_dir / stored_name)
    return f"{VIDEO_FOLDERS}/{stored_name}", VIDEO_TYPES[extension]


def save_poster(file: FileStorage, upload_folder: str | Path) -> str:
    filename = file.filename or ""
    extension = _extension(filename)
    if extension not in IMAGE_TYPES:
        raise ValueError("El póster debe ser .jpg, .png o .webp.")
    if not _sniff_image(file.stream, extension):
        raise ValueError("El archivo no parece una imagen válida.")

    target_dir = Path(upload_folder) / POSTER_FOLDERS
    target_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    file.save(target_dir / stored_name)
    return f"{POSTER_FOLDERS}/{stored_name}"


def resolve_upload(upload_folder: str | Path, relative: str | None) -> Path | None:
    if not relative:
        return None
    root = Path(upload_folder).resolve()
    candidate = (root / relative).resolve()
    if root not in candidate.parents and candidate != root:
        return None
    return candidate


def remove_upload(upload_folder: str | Path, relative: str | None) -> None:
    path = resolve_upload(upload_folder, relative)
    if not path:
        return
    try:
        if path.is_file():
            os.unlink(path)
    except OSError:
        pass
    if relative and str(relative).startswith('posters/'):
        stem = Path(relative).stem
        thumbs_dir = Path(upload_folder) / 'posters' / 'thumbs'
        if thumbs_dir.is_dir():
            for thumb in thumbs_dir.glob(f'{stem}_*'):
                try:
                    os.unlink(thumb)
                except OSError:
                    pass
