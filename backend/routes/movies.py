from __future__ import annotations

import mimetypes
from pathlib import Path

from flask import Blueprint, current_app, jsonify, redirect, request, send_file
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models import Category, Movie
from ..security import get_current_user, login_required
from ..services.storage import storage
from ..utils.files import resolve_upload
from ..utils.poster import fallback_poster
from ..utils.slugs import slugify
from ..utils.streaming import video_response
from ..utils.thumbnails import get_or_create_thumbnail

movies_bp = Blueprint("movies", __name__, url_prefix="/api/movies")

TRUE_VALUES = {"1", "true", "on", "yes", "si", "sí"}


def _payload():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form


def _optional_bool(value, default=None):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in TRUE_VALUES


def _optional_int(value, field: str, minimum: int, maximum: int):
    if value is None or str(value).strip() == "":
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} debe ser un número entero.")
    if number < minimum or number > maximum:
        raise ValueError(f"{field} debe estar entre {minimum} y {maximum}.")
    return number


def _apply_fields(movie: Movie, data, partial: bool) -> None:
    if "title" in data or not partial:
        title = str(data.get("title") or "").strip()
        if not title:
            raise ValueError("El título es obligatorio.")
        if len(title) > 180:
            raise ValueError("El título no puede superar 180 caracteres.")
        movie.title = title

    if "description" in data:
        movie.description = str(data.get("description") or "").strip()

    if "year" in data:
        movie.year = _optional_int(data.get("year"), "El año", 1888, 2100)

    if "duration" in data:
        movie.duration = _optional_int(data.get("duration"), "La duración", 0, 600)

    if "rating" in data:
        rating = str(data.get("rating") or "TP").strip().upper()
        movie.rating = rating[:16] or "TP"

    if "category_id" in data:
        raw = data.get("category_id")
        if raw in (None, "", "null"):
            movie.category_id = None
        else:
            try:
                category_id = int(raw)
            except (TypeError, ValueError):
                raise ValueError("La categoría seleccionada no es válida.")
            if not db.session.get(Category, category_id):
                raise ValueError("La categoría seleccionada no existe.")
            movie.category_id = category_id

    if "featured" in data:
        movie.featured = bool(_optional_bool(data.get("featured"), False))

    if "published" in data:
        movie.published = bool(_optional_bool(data.get("published"), True))


def _base_query(include_all: bool):
    query = Movie.query.options(joinedload(Movie.category))
    if not include_all:
        query = query.filter(Movie.published.is_(True))
    return query


@movies_bp.get("")
def list_movies():
    include_all = request.args.get("all") == "1" and bool(get_current_user())
    query = _base_query(include_all)

    category_slug = (request.args.get("category") or "").strip()
    if category_slug and category_slug.lower() != "todas":
        query = query.join(Category).filter(Category.slug == category_slug)

    search = (request.args.get("q") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Movie.title.ilike(pattern), Movie.description.ilike(pattern))
        )

    if request.args.get("featured") == "1":
        query = query.filter(Movie.featured.is_(True))

    query = query.order_by(
        Movie.featured.desc(),
        Movie.year.desc(),
        Movie.created_at.desc(),
    )

    if request.args.get("limit"):
        try:
            limit = max(1, min(int(request.args["limit"]), 200))
            query = query.limit(limit)
        except ValueError:
            pass

    return jsonify(movies=[movie.to_dict() for movie in query.all()])


@movies_bp.get("/<int:movie_id>")
def get_movie(movie_id: int):
    movie = db.session.get(Movie, movie_id)
    if not movie or (not movie.published and not get_current_user()):
        return jsonify(error="Película no encontrada."), 404
    return jsonify(movie=movie.to_dict())


@movies_bp.post("")
@login_required
def create_movie():
    data = _payload()
    video = request.files.get("video")
    poster = request.files.get("poster")

    if not video or not video.filename:
        return jsonify(error="Selecciona un tráiler .mp4 o .webm."), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    movie = Movie(title="", video_file="")
    saved_video = None
    saved_poster = None

    try:
        _apply_fields(movie, data, partial=False)
        saved_video, video_mime = storage.save_video(video, upload_folder)
        movie.video_file = saved_video
        movie.video_mime = video_mime

        if poster and poster.filename:
            saved_poster = storage.save_poster(poster, upload_folder)
            movie.poster_file = saved_poster

        db.session.add(movie)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        if saved_video:
            storage.remove_file(upload_folder, saved_video)
        if saved_poster:
            storage.remove_file(upload_folder, saved_poster)
        return jsonify(error=str(exc)), 400
    except Exception:
        db.session.rollback()
        if saved_video:
            storage.remove_file(upload_folder, saved_video)
        if saved_poster:
            storage.remove_file(upload_folder, saved_poster)
        raise

    return jsonify(movie=movie.to_dict()), 201


@movies_bp.patch("/<int:movie_id>")
@login_required
def update_movie(movie_id: int):
    movie = db.session.get(Movie, movie_id)
    if not movie:
        return jsonify(error="Película no encontrada."), 404

    data = _payload()
    video = request.files.get("video")
    poster = request.files.get("poster")
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    old_video = movie.video_file
    old_poster = movie.poster_file
    saved_video = None
    saved_poster = None

    try:
        _apply_fields(movie, data, partial=True)

        if video and video.filename:
            saved_video, video_mime = storage.save_video(video, upload_folder)
            movie.video_file = saved_video
            movie.video_mime = video_mime

        if poster and poster.filename:
            saved_poster = storage.save_poster(poster, upload_folder)
            movie.poster_file = saved_poster

        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        if saved_video:
            storage.remove_file(upload_folder, saved_video)
        if saved_poster:
            storage.remove_file(upload_folder, saved_poster)
        return jsonify(error=str(exc)), 400
    except Exception:
        db.session.rollback()
        if saved_video:
            storage.remove_file(upload_folder, saved_video)
        if saved_poster:
            storage.remove_file(upload_folder, saved_poster)
        raise

    if saved_video and old_video:
        storage.remove_file(upload_folder, old_video)
    if saved_poster and old_poster:
        storage.remove_file(upload_folder, old_poster)

    return jsonify(movie=movie.to_dict())


@movies_bp.delete("/<int:movie_id>")
@login_required
def delete_movie(movie_id: int):
    movie = db.session.get(Movie, movie_id)
    if not movie:
        return jsonify(error="Película no encontrada."), 404

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    video_file = movie.video_file
    poster_file = movie.poster_file
    db.session.delete(movie)
    db.session.commit()
    storage.remove_file(upload_folder, video_file)
    storage.remove_file(upload_folder, poster_file)
    return jsonify(message="Película eliminada.")


@movies_bp.get("/<int:movie_id>/stream")
def stream_movie(movie_id: int):
    movie = db.session.get(Movie, movie_id)
    if not movie:
        return jsonify(error="Película no encontrada."), 404

    # Si S3 está activo, redirigir a URL prefirmada de S3 (streaming nativo directo y rápido)
    if storage.is_s3_enabled and movie.video_file:
        s3_url = storage.get_stream_url(movie.video_file)
        if s3_url:
            return redirect(s3_url, code=302)

    path = resolve_upload(current_app.config["UPLOAD_FOLDER"], movie.video_file)
    if not path or not path.is_file():
        return jsonify(error="El archivo del tráiler no está disponible."), 404

    extension = path.suffix.lower()
    download_name = f"{slugify(movie.title)}{extension}"
    return video_response(path, movie.video_mime, filename=download_name)


@movies_bp.get("/<int:movie_id>/poster")
def poster_movie(movie_id: int):
    movie = db.session.get(Movie, movie_id)
    if not movie:
        return jsonify(error="Película no encontrada."), 404

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    use_thumb = request.args.get("thumb") == "1" or request.args.get("w") is not None

    # Si S3 está activo, redirigir a URL prefirmada de S3
    if storage.is_s3_enabled and movie.poster_file:
        s3_url = storage.get_poster_url(movie.poster_file, thumb=use_thumb)
        if s3_url:
            return redirect(s3_url, code=302)

    if movie.poster_file:
        if use_thumb:
            thumb_path = get_or_create_thumbnail(upload_folder, movie.poster_file)
            if thumb_path and thumb_path.is_file():
                return send_file(
                    thumb_path,
                    mimetype="image/webp",
                    conditional=True,
                    etag=True,
                    max_age=86400,
                    as_attachment=False,
                )

        path = resolve_upload(upload_folder, movie.poster_file)
        if path and path.is_file():
            mimetype = mimetypes.guess_type(str(path))[0] or "image/jpeg"
            return send_file(
                path,
                mimetype=mimetype,
                conditional=True,
                etag=True,
                max_age=86400,
                as_attachment=False,
            )

    return fallback_poster(movie)
