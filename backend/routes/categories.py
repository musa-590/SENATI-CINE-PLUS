from __future__ import annotations

import re

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Category
from ..security import get_current_user, login_required
from ..utils.slugs import unique_slug

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")

HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _payload():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form


def _clean_accent(value, fallback="#c9b79f"):
    accent = str(value or "").strip()
    return accent if HEX_RE.match(accent) else fallback


@categories_bp.get("")
def list_categories():
    include_all = request.args.get("all") == "1" and bool(get_current_user())
    categories = Category.query.order_by(Category.sort_order.asc(), Category.name.asc()).all()
    return jsonify(
        categories=[
            category.to_dict(include_count=True, public_only=not include_all)
            for category in categories
        ]
    )


@categories_bp.post("")
@login_required
def create_category():
    data = _payload()
    name = str(data.get("name") or "").strip()
    if len(name) < 2:
        return jsonify(error="El nombre de la categoría es demasiado corto."), 400

    if Category.query.filter(db.func.lower(Category.name) == name.lower()).first():
        return jsonify(error="Ya existe una categoría con ese nombre."), 409

    sort_order = data.get("sort_order")
    try:
        sort_order = int(sort_order) if sort_order not in (None, "") else 0
    except (TypeError, ValueError):
        sort_order = 0

    category = Category(
        name=name,
        slug=unique_slug(Category, name),
        accent=_clean_accent(data.get("accent")),
        sort_order=sort_order,
    )
    db.session.add(category)
    db.session.commit()
    return jsonify(category=category.to_dict(include_count=True)), 201


@categories_bp.patch("/<int:category_id>")
@login_required
def update_category(category_id: int):
    category = db.session.get(Category, category_id)
    if not category:
        return jsonify(error="Categoría no encontrada."), 404

    data = _payload()
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if len(name) < 2:
            return jsonify(error="El nombre de la categoría es demasiado corto."), 400
        duplicate = Category.query.filter(
            db.func.lower(Category.name) == name.lower(), Category.id != category.id
        ).first()
        if duplicate:
            return jsonify(error="Ya existe una categoría con ese nombre."), 409
        category.name = name
        category.slug = unique_slug(Category, name, exclude_id=category.id)
    if "accent" in data:
        category.accent = _clean_accent(data.get("accent"), category.accent)
    if "sort_order" in data:
        try:
            category.sort_order = int(data.get("sort_order") or 0)
        except (TypeError, ValueError):
            pass

    db.session.commit()
    return jsonify(category=category.to_dict(include_count=True))


@categories_bp.delete("/<int:category_id>")
@login_required
def delete_category(category_id: int):
    category = db.session.get(Category, category_id)
    if not category:
        return jsonify(error="Categoría no encontrada."), 404
    if category.movies.count() > 0:
        return jsonify(
            error="No puedes borrar una categoría que todavía tiene películas."
        ), 409

    db.session.delete(category)
    db.session.commit()
    return jsonify(message="Categoría eliminada.")
