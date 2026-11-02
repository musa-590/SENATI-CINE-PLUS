from __future__ import annotations

from html import escape

from flask import Response


def _wrap_title(title: str, limit: int = 15) -> list[str]:
    words = (title or "Sin título").split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > limit and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:4]


def fallback_poster(movie) -> Response:
    accent = movie.category.accent if movie.category else "#c9b79f"
    category = movie.category.name.upper() if movie.category else "CINE PLUS"
    year = movie.year or ""
    title_lines = _wrap_title(movie.title, 14)
    title_markup = "".join(
        f'<tspan x="60" dy="{0 if index == 0 else 84}">{escape(line)}</tspan>'
        for index, line in enumerate(title_lines)
    )
    initials = "".join(line[:1] for line in title_lines[:2]).upper() or "C+"

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080" viewBox="0 0 720 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#161310"/>
      <stop offset="0.55" stop-color="#0d0b09"/>
      <stop offset="1" stop-color="#1b1713"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.18" r="0.8">
      <stop offset="0" stop-color="{accent}" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="{accent}" stop-opacity="0.09"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="lines" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M 72 0 L 0 0 0 72" fill="none" stroke="#f4ede2" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="720" height="1080" fill="url(#bg)"/>
  <rect width="720" height="1080" fill="url(#glow)"/>
  <rect width="720" height="1080" fill="url(#lines)"/>
  <circle cx="590" cy="220" r="150" fill="none" stroke="{accent}" stroke-opacity="0.45" stroke-width="1"/>
  <circle cx="590" cy="220" r="110" fill="none" stroke="{accent}" stroke-opacity="0.22" stroke-width="1"/>
  <text x="60" y="94" fill="#f4ede2" font-family="Segoe UI, system-ui, sans-serif" font-size="17" letter-spacing="5">{escape(category)}</text>
  <text x="60" y="150" fill="{accent}" font-family="Segoe UI, system-ui, sans-serif" font-size="13" letter-spacing="4">CINE PLUS · TRAILER</text>
  <text x="60" y="470" fill="#f4ede2" font-family="Arial Black, Segoe UI, system-ui, sans-serif" font-size="76" font-weight="900" letter-spacing="-1">{title_markup}</text>
  <text x="64" y="880" fill="{accent}" font-family="Arial Black, Segoe UI, system-ui, sans-serif" font-size="150" font-weight="900" opacity="0.16">{escape(initials)}</text>
  <line x1="60" y1="930" x2="660" y2="930" stroke="#f4ede2" stroke-opacity="0.18" stroke-width="1"/>
  <text x="60" y="990" fill="#b9ad9e" font-family="Segoe UI, system-ui, sans-serif" font-size="20" letter-spacing="2">{escape(str(year))}</text>
  <text x="660" y="990" text-anchor="end" fill="#b9ad9e" font-family="Segoe UI, system-ui, sans-serif" font-size="16" letter-spacing="3">CINE PLUS</text>
</svg>"""

    response = Response(svg, mimetype="image/svg+xml")
    response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800"
    etag_seed = f"poster-{movie.id}-{movie.updated_at or ''}"
    response.set_etag(etag_seed)
    return response
