from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageOps
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

THUMBS_DIR = "thumbs"
DEFAULT_THUMB_WIDTH = 380


def get_or_create_thumbnail(
    upload_folder: str | Path,
    relative_poster_path: str,
    max_width: int = DEFAULT_THUMB_WIDTH,
    quality: int = 82,
) -> Optional[Path]:
    """Genera y cachea una miniatura WebP optimizada de un póster si Pillow está disponible."""
    if not HAS_PILLOW or not relative_poster_path:
        return None

    root = Path(upload_folder).resolve()
    source_path = (root / relative_poster_path).resolve()
    if not source_path.is_file():
        return None

    # Guardar en uploads/posters/thumbs/<filename_stem>.webp
    source_stem = source_path.stem
    thumbs_dir = root / "posters" / THUMBS_DIR
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    thumb_filename = f"{source_stem}_{max_width}w.webp"
    thumb_path = thumbs_dir / thumb_filename

    # Si ya existe y es más reciente que el original, reutilizar
    try:
        if thumb_path.is_file():
            if thumb_path.stat().st_mtime >= source_path.stat().st_mtime:
                return thumb_path
    except OSError:
        pass

    try:
        with Image.open(source_path) as img:
            # Respetar orientación EXIF
            img = ImageOps.exif_transpose(img)
            
            # Convertir a RGB si es necesario (RGBA para transparencia, RGB para JPEG)
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

            # Redimensionar manteniendo ratio
            width, height = img.size
            if width > max_width:
                ratio = max_width / float(width)
                new_size = (max_width, max(1, int(float(height) * ratio)))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            # Guardar como WebP optimizado
            img.save(thumb_path, format="WEBP", quality=quality, method=4)
            return thumb_path
    except Exception:
        return None
