from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, jsonify

from ..models import Category, Movie
from ..security import login_required
from ..services.movie_service import get_folder_storage_mb

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/stats")
@login_required
def stats():
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    return jsonify(
        movies=Movie.query.count(),
        published=Movie.query.filter(Movie.published.is_(True)).count(),
        featured=Movie.query.filter(Movie.featured.is_(True)).count(),
        categories=Category.query.count(),
        storage_mb=get_folder_storage_mb(upload_folder),
    )
