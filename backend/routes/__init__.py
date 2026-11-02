from .admin import admin_bp
from .auth import auth_bp
from .categories import categories_bp
from .movies import movies_bp
from .web import web_bp

__all__ = ["admin_bp", "auth_bp", "categories_bp", "movies_bp", "web_bp"]
