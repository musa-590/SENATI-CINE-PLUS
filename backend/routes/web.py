from __future__ import annotations

from flask import (
    Blueprint,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)

from ..models import User
from ..security import get_current_user, login_required, login_user, logout_user
from ..services.movie_service import get_admin_dashboard_data, get_billboard_data

web_bp = Blueprint("web", __name__)


@web_bp.get("/")
def billboard_view():
    """Cartelera pública con renderizado SSR completo."""
    data = get_billboard_data()
    return render_template(
        "public.html",
        movies=data["movies"],
        categories=data["categories"],
        featured_movies=data["featured_movies"],
        stats=data["stats"],
        current_user=get_current_user(),
    )


@web_bp.route("/admin/login", methods=["GET", "POST"])
def login_view():
    """Página y procesamiento de inicio de sesión de administración."""
    if get_current_user():
        return redirect(url_for("web.admin_dashboard_view"))

    error = None
    next_url = request.args.get("next") or request.form.get("next") or url_for("web.admin_dashboard_view")

    if request.method == "POST":
        email = str(request.form.get("email") or "").strip().lower()
        password = str(request.form.get("password") or "")

        if not email or not password:
            error = "Escribe tu correo y contraseña."
        else:
            user = User.query.filter(User.email == email).first()
            if not user or not user.check_password(password):
                error = "Correo o contraseña incorrectos."
            else:
                login_user(user)
                flash(f"Bienvenido, {user.name}.", "success")
                return redirect(next_url)

    return render_template("login.html", error=error, next_url=next_url)


@web_bp.get("/admin/logout")
def logout_view():
    """Cierra la sesión del administrador y vuelve a la cartelera pública."""
    logout_user()
    flash("Has cerrado sesión.", "info")
    return redirect(url_for("web.billboard_view"))


@web_bp.get("/admin")
@login_required
def admin_dashboard_view():
    """Panel de administración completo (Biblioteca, Categorías y Cuenta)."""
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    data = get_admin_dashboard_data(upload_folder)
    return render_template(
        "admin.html",
        movies=data["movies"],
        categories=data["categories"],
        stats=data["stats"],
        current_user=get_current_user(),
    )
