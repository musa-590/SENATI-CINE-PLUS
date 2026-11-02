from __future__ import annotations

import hmac
import secrets
from functools import wraps
from typing import Optional

from flask import current_app, g, jsonify, redirect, request, session, url_for

from .extensions import db
from .models import User

CSRF_SESSION_KEY = "_csrf_token"


def generate_csrf_token() -> str:
    """Obtiene o genera un token CSRF criptográficamente seguro en la sesión."""
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf_token(token: Optional[str]) -> bool:
    """Valida un token CSRF contra el almacenado en la sesión de forma inmune a timing attacks."""
    stored = session.get(CSRF_SESSION_KEY)
    if not stored or not token:
        return False
    return hmac.compare_digest(stored, token)


def get_current_user() -> Optional[User]:
    """Recupera el usuario de la sesión actual, cacheado en flask.g."""
    if hasattr(g, "current_user"):
        return g.current_user

    user_id = session.get("user_id")
    if not user_id:
        g.current_user = None
        return None

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        g.current_user = None
        return None

    g.current_user = user
    return user


def login_user(user: User) -> None:
    """Inicia sesión para un usuario con cookies HttpOnly seguras."""
    session.clear()
    session["user_id"] = user.id
    session["user_name"] = user.name
    session["user_email"] = user.email
    session.permanent = True
    generate_csrf_token()
    g.current_user = user


def logout_user() -> None:
    """Cierra la sesión actual y limpia la cookie."""
    session.clear()
    g.current_user = None


def login_required(f):
    """Protege vistas que requieren autenticación de administrador."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            # Si es solicitud de API o JSON, responder con 401 JSON
            if (
                request.path.startswith("/api/")
                or request.is_json
                or request.headers.get("X-Requested-With") == "XMLHttpRequest"
                or "application/json" in request.headers.get("Accept", "")
            ):
                return jsonify(error="Inicia sesión para continuar."), 401
            return redirect(url_for("web.login_view", next=request.full_path))
        return f(*args, **kwargs)
    return decorated


def verify_csrf():
    """Verifica el token CSRF para solicitudes mutantes (POST, PATCH, PUT, DELETE)."""
    if request.method in ("POST", "PATCH", "PUT", "DELETE"):
        # Permitir login sin token previo si aún no hay sesión
        token = (
            request.headers.get("X-CSRFToken")
            or request.headers.get("X-CSRF-Token")
            or request.form.get("csrf_token")
        )
        if not validate_csrf_token(token):
            if request.path.startswith("/api/") or request.is_json:
                return jsonify(error="Token CSRF inválido o ausente. Recarga la página."), 403
            return (
                "<h3>Error 403: Token CSRF inválido o sesión expirada. Por favor, vuelve a la página anterior y recarga.</h3>",
                403,
            )
    return None
