from __future__ import annotations

import io
import logging
import os
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Tuple

from werkzeug.datastructures import FileStorage

if TYPE_CHECKING:
    pass

try:
    from PIL import Image, ImageOps
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

logger = logging.getLogger("cineplus.storage")

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

VIDEO_FOLDER = "videos"
POSTER_FOLDER = "posters"
THUMBS_FOLDER = "posters/thumbs"
DEFAULT_THUMB_WIDTH = 380


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


def _generate_thumb_bytes(stream, max_width: int = DEFAULT_THUMB_WIDTH) -> bytes | None:
    if not HAS_PILLOW:
        return None
    try:
        stream.seek(0)
        with Image.open(stream) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

            width, height = img.size
            if width > max_width:
                ratio = max_width / float(width)
                new_size = (max_width, max(1, int(float(height) * ratio)))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            img.save(buffer, format="WEBP", quality=82, method=4)
            stream.seek(0)
            return buffer.getvalue()
    except Exception as exc:
        logger.warning("No se pudo generar miniatura en memoria: %s", exc)
        stream.seek(0)
        return None


class StorageService:
    def __init__(self, bucket_name: str | None = None, region_name: str | None = None):
        self.bucket_name = bucket_name or os.getenv("S3_BUCKET_NAME", "")
        self.region_name = region_name or os.getenv("AWS_REGION", "us-east-1")
        self._s3_client = None

    @property
    def is_s3_enabled(self) -> bool:
        return bool(self.bucket_name)

    def _get_s3(self):
        if self._s3_client is None:
            import boto3
            self._s3_client = boto3.client("s3", region_name=self.region_name)
        return self._s3_client

    def save_video(self, file: FileStorage, upload_folder: str | Path) -> Tuple[str, str]:
        filename = file.filename or ""
        ext = _extension(filename)
        if ext not in VIDEO_TYPES:
            raise ValueError("El tráiler debe ser un archivo .mp4 o .webm.")
        if not _sniff_video(file.stream, ext):
            raise ValueError("El archivo no parece un vídeo MP4/WebM válido.")

        stored_name = f"{uuid.uuid4().hex}{ext}"
        relative_path = f"{VIDEO_FOLDER}/{stored_name}"
        mime_type = VIDEO_TYPES[ext]

        if self.is_s3_enabled:
            s3 = self._get_s3()
            file.stream.seek(0)
            s3.upload_fileobj(
                file.stream,
                self.bucket_name,
                relative_path,
                ExtraArgs={"ContentType": mime_type},
            )
            logger.info("Vídeo subido a S3: s3://%s/%s", self.bucket_name, relative_path)
            return relative_path, mime_type

        # Almacenamiento local
        target_dir = Path(upload_folder) / VIDEO_FOLDER
        target_dir.mkdir(parents=True, exist_ok=True)
        file.save(target_dir / stored_name)
        return relative_path, mime_type

    def save_poster(self, file: FileStorage, upload_folder: str | Path) -> str:
        filename = file.filename or ""
        ext = _extension(filename)
        if ext not in IMAGE_TYPES:
            raise ValueError("El póster debe ser .jpg, .png o .webp.")
        if not _sniff_image(file.stream, ext):
            raise ValueError("El archivo no parece una imagen válida.")

        uuid_key = uuid.uuid4().hex
        stored_name = f"{uuid_key}{ext}"
        relative_path = f"{POSTER_FOLDER}/{stored_name}"
        mime_type = IMAGE_TYPES[ext]

        if self.is_s3_enabled:
            s3 = self._get_s3()
            # Generar miniatura en memoria si es posible
            thumb_bytes = _generate_thumb_bytes(file.stream)
            file.stream.seek(0)
            s3.upload_fileobj(
                file.stream,
                self.bucket_name,
                relative_path,
                ExtraArgs={"ContentType": mime_type},
            )

            if thumb_bytes:
                thumb_key = f"{THUMBS_FOLDER}/{uuid_key}_{DEFAULT_THUMB_WIDTH}w.webp"
                s3.put_object(
                    Bucket=self.bucket_name,
                    Key=thumb_key,
                    Body=thumb_bytes,
                    ContentType="image/webp",
                )
            logger.info("Póster subido a S3: s3://%s/%s", self.bucket_name, relative_path)
            return relative_path

        # Almacenamiento local
        target_dir = Path(upload_folder) / POSTER_FOLDER
        target_dir.mkdir(parents=True, exist_ok=True)
        file.save(target_dir / stored_name)
        return relative_path

    def remove_file(self, upload_folder: str | Path, relative: str | None) -> None:
        if not relative:
            return

        if self.is_s3_enabled:
            try:
                s3 = self._get_s3()
                s3.delete_object(Bucket=self.bucket_name, Key=relative)
                if relative.startswith("posters/"):
                    stem = Path(relative).stem
                    thumb_key = f"{THUMBS_FOLDER}/{stem}_{DEFAULT_THUMB_WIDTH}w.webp"
                    try:
                        s3.delete_object(Bucket=self.bucket_name, Key=thumb_key)
                    except Exception:
                        pass
                logger.info("Archivo eliminado de S3: s3://%s/%s", self.bucket_name, relative)
            except Exception as exc:
                logger.warning("Error al eliminar archivo de S3 (%s): %s", relative, exc)
            return

        # Almacenamiento local
        root = Path(upload_folder).resolve()
        candidate = (root / relative).resolve()
        if root not in candidate.parents and candidate != root:
            return
        try:
            if candidate.is_file():
                os.unlink(candidate)
        except OSError:
            pass

        if relative.startswith("posters/"):
            stem = Path(relative).stem
            thumbs_dir = Path(upload_folder) / "posters" / "thumbs"
            if thumbs_dir.is_dir():
                for thumb in thumbs_dir.glob(f"{stem}_*"):
                    try:
                        os.unlink(thumb)
                    except OSError:
                        pass

    def get_presigned_url(self, relative_path: str, expires_in: int = 3600) -> str | None:
        if not self.is_s3_enabled or not relative_path:
            return None
        try:
            s3 = self._get_s3()
            return s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": relative_path},
                ExpiresIn=expires_in,
            )
        except Exception as exc:
            logger.warning("Error al generar Presigned URL para %s: %s", relative_path, exc)
            return None

    def get_stream_url(self, video_file: str) -> str | None:
        return self.get_presigned_url(video_file, expires_in=7200)

    def get_poster_url(self, poster_file: str, thumb: bool = False) -> str | None:
        if not self.is_s3_enabled or not poster_file:
            return None
        key = poster_file
        if thumb:
            stem = Path(poster_file).stem
            key = f"{THUMBS_FOLDER}/{stem}_{DEFAULT_THUMB_WIDTH}w.webp"
        return self.get_presigned_url(key, expires_in=86400)


storage = StorageService()
