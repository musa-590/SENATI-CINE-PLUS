from __future__ import annotations

import re
from pathlib import Path

from flask import Response, request, send_file, stream_with_context

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def video_response(path: Path, mimetype: str, filename: str | None = None) -> Response:
    """Sirve un vídeo con soporte de HTTP Range (necesario para buscar en el player)."""

    size = path.stat().st_size
    range_header = request.headers.get("Range")
    download_name = filename or path.name

    if not range_header:
        response = send_file(
            path,
            mimetype=mimetype,
            conditional=True,
            etag=True,
            max_age=3600,
            as_attachment=False,
            download_name=download_name,
        )
        response.headers["Accept-Ranges"] = "bytes"
        response.headers["Content-Disposition"] = f'inline; filename="{download_name}"'
        return response

    match = RANGE_RE.match(range_header.strip())
    if not match:
        return Response(status=416, headers={"Content-Range": f"bytes */{size}"})

    start_text, end_text = match.groups()
    if start_text:
        start = int(start_text)
        end = int(end_text) if end_text else size - 1
    else:
        suffix = int(end_text or "0")
        if suffix <= 0:
            return Response(status=416, headers={"Content-Range": f"bytes */{size}"})
        start = max(0, size - suffix)
        end = size - 1

    if start >= size or start > end:
        return Response(status=416, headers={"Content-Range": f"bytes */{size}"})

    end = min(end, size - 1)
    length = end - start + 1

    def generate():
        with path.open("rb") as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(256 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    response = Response(
        stream_with_context(generate()),
        status=206,
        mimetype=mimetype,
        direct_passthrough=True,
    )
    response.headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["Content-Length"] = str(length)
    response.headers["Content-Disposition"] = f'inline; filename="{download_name}"'
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response
