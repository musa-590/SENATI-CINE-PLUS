from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Category, Movie


def get_folder_storage_mb(folder_path: str | Path) -> float:
    """Calcula el tamaño en MB de los archivos en la carpeta de uploads."""
    total = 0
    folder = Path(folder_path)
    if not folder.exists():
        return 0.0
    for root, _, files in os.walk(folder):
        for name in files:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                pass
    return round(total / (1024 * 1024), 1)


def get_categories(include_count: bool = True, public_only: bool = True) -> List[Dict[str, Any]]:
    """Obtiene categorías ordenadas con su conteo de películas."""
    categories = Category.query.order_by(Category.sort_order.asc(), Category.name.asc()).all()
    return [
        category.to_dict(include_count=include_count, public_only=public_only)
        for category in categories
    ]


def get_movies(
    category_slug: Optional[str] = None,
    search_query: Optional[str] = None,
    featured_only: bool = False,
    include_all: bool = False,
    limit: Optional[int] = None,
) -> List[Movie]:
    """Consulta flexible de películas para cartelera y administración."""
    query = Movie.query.options(joinedload(Movie.category))
    if not include_all:
        query = query.filter(Movie.published.is_(True))

    if category_slug and category_slug.strip().lower() != "todas":
        query = query.join(Category).filter(Category.slug == category_slug.strip().lower())

    if search_query and search_query.strip():
        term = f"%{search_query.strip()}%"
        query = query.filter(
            or_(Movie.title.ilike(term), Movie.description.ilike(term))
        )

    if featured_only:
        query = query.filter(Movie.featured.is_(True))

    query = query.order_by(
        Movie.featured.desc(),
        Movie.year.desc(),
        Movie.created_at.desc(),
    )

    if limit and limit > 0:
        query = query.limit(limit)

    return query.all()


def get_billboard_data() -> Dict[str, Any]:
    """Obtiene los datos iniciales completos para el renderizado SSR de la cartelera."""
    movies = get_movies(include_all=False)
    categories = get_categories(include_count=True, public_only=True)
    featured = [m for m in movies if m.featured][:9]
    if not featured and movies:
        featured = movies[:6]

    total_count = len(movies)
    featured_count = sum(1 for m in movies if m.featured)

    return {
        "movies": movies,
        "categories": categories,
        "featured_movies": featured,
        "stats": {
            "total": total_count,
            "categories": len(categories),
            "featured": featured_count,
        },
    }


def get_admin_dashboard_data(upload_folder: str | Path) -> Dict[str, Any]:
    """Obtiene los datos completos para el renderizado del panel de administración."""
    movies = get_movies(include_all=True)
    categories = get_categories(include_count=True, public_only=False)

    published_count = sum(1 for m in movies if m.published)
    featured_count = sum(1 for m in movies if m.featured)
    unpublished_count = len(movies) - published_count
    without_category_count = sum(1 for m in movies if not m.category)

    storage_mb = get_folder_storage_mb(upload_folder)

    stats = {
        "movies": len(movies),
        "published": published_count,
        "featured": featured_count,
        "unpublished": unpublished_count,
        "without_category": without_category_count,
        "categories": len(categories),
        "storage_mb": storage_mb,
    }

    return {
        "movies": movies,
        "categories": categories,
        "stats": stats,
    }
