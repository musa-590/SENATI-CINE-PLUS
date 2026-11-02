from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import User
from ..security import generate_csrf_token, get_current_user, login_required, login_user, logout_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def api_login():
    payload = request.get_json(silent=True) or request.form or {}
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")

    if not email or not password:
        return jsonify(error="Escribe tu correo y contraseña."), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user or not user.check_password(password):
        return jsonify(error="Correo o contraseña incorrectos."), 401

    login_user(user)
    return jsonify(user=user.to_dict(), csrf_token=generate_csrf_token())


@auth_bp.get("/me")
@login_required
def api_me():
    user = get_current_user()
    if not user:
        return jsonify(error="Sesión no válida."), 401
    return jsonify(user=user.to_dict())


@auth_bp.post("/logout")
def api_logout():
    logout_user()
    return jsonify(message="Sesión cerrada correctamente.")


@auth_bp.post("/change-password")
@login_required
def api_change_password():
    user = get_current_user()
    if not user:
        return jsonify(error="Sesión no válida."), 401

    payload = request.get_json(silent=True) or request.form or {}
    current_password = str(payload.get("current_password") or "")
    new_password = str(payload.get("new_password") or "")

    if not user.check_password(current_password):
        return jsonify(error="La contraseña actual no coincide."), 400
    if len(new_password) < 8:
        return jsonify(error="La nueva contraseña debe tener al menos 8 caracteres."), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify(message="Contraseña actualizada correctamente.")
