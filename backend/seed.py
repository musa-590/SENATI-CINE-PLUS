from flask import current_app

from .extensions import db
from .models import Category, User
from .utils.slugs import slugify

DEFAULT_CATEGORIES = [
    {"name": "Acción", "accent": "#c08a6b", "sort_order": 10},
    {"name": "Drama", "accent": "#a8927b", "sort_order": 20},
    {"name": "Ciencia Ficción", "accent": "#8fa3a8", "sort_order": 30},
    {"name": "Terror", "accent": "#9c8aa3", "sort_order": 40},
    {"name": "Animación", "accent": "#c4b283", "sort_order": 50},
]


def seed_defaults() -> None:
    created_categories = 0
    for item in DEFAULT_CATEGORIES:
        proposed_slug = slugify(item["name"])
        with db.session.no_autoflush:
            existing = Category.query.filter_by(slug=proposed_slug).first()
        if existing is not None:
            continue

        db.session.add(
            Category(
                name=item["name"],
                slug=proposed_slug,
                accent=item["accent"],
                sort_order=item["sort_order"],
            )
        )
        created_categories += 1

    admin_email = current_app.config["ADMIN_EMAIL"].strip().lower()
    with db.session.no_autoflush:
        admin = User.query.filter(db.func.lower(User.email) == admin_email).first()
    if not admin:
        admin = User(
            name=current_app.config["ADMIN_NAME"],
            email=admin_email,
        )
        admin.set_password(current_app.config["ADMIN_PASSWORD"])
        db.session.add(admin)

    if created_categories or (admin is not None and admin.id is None):
        db.session.commit()
