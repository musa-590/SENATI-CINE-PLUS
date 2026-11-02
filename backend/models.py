from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, default="Administrador")
    email = db.Column(db.String(190), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "email": self.email}


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    slug = db.Column(db.String(90), unique=True, nullable=False, index=True)
    accent = db.Column(db.String(16), nullable=False, default="#c9b79f")
    sort_order = db.Column(db.Integer, nullable=False, default=0)

    movies = db.relationship("Movie", back_populates="category", lazy="dynamic")

    def to_dict(self, include_count: bool = False, public_only: bool = False) -> dict:
        payload = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "accent": self.accent,
        }
        if include_count:
            query = self.movies
            if public_only:
                query = query.filter(Movie.published.is_(True))
            payload["movie_count"] = query.count()
        return payload


class Movie(db.Model):
    __tablename__ = "movies"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False, default="")
    year = db.Column(db.Integer, nullable=True)
    duration = db.Column(db.Integer, nullable=True)
    rating = db.Column(db.String(16), nullable=False, default="TP")

    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category = db.relationship("Category", back_populates="movies")

    video_file = db.Column(db.String(255), nullable=False)
    video_mime = db.Column(db.String(64), nullable=False, default="video/mp4")
    poster_file = db.Column(db.String(255), nullable=True)

    featured = db.Column(db.Boolean, nullable=False, default=False, index=True)
    published = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    @property
    def poster_url(self) -> str:
        return f"/api/movies/{self.id}/poster"

    @property
    def poster_thumb_url(self) -> str:
        return f"/api/movies/{self.id}/poster?thumb=1"

    @property
    def stream_url(self) -> str:
        return f"/api/movies/{self.id}/stream"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description or "",
            "year": self.year,
            "duration": self.duration,
            "rating": self.rating,
            "featured": bool(self.featured),
            "published": bool(self.published),
            "category": self.category.to_dict() if self.category else None,
            "poster_url": f"/api/movies/{self.id}/poster",
            "poster_thumb_url": f"/api/movies/{self.id}/poster?thumb=1",
            "stream_url": f"/api/movies/{self.id}/stream",
            "video_type": self.video_mime,
            "created_at": self.created_at.isoformat(timespec="seconds") if self.created_at else None,
            "updated_at": self.updated_at.isoformat(timespec="seconds") if self.updated_at else None,
        }
