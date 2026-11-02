from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from sqlalchemy.exc import OperationalError
from werkzeug.middleware.proxy_fix import ProxyFix

from .bootstrap import ensure_database
from .config import Config
from .extensions import db
from .security import generate_csrf_token, get_current_user, verify_csrf
from .seed import seed_defaults


def create_app(config_class=Config) -> Flask:
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
    )
    app.config.from_object(config_class)
    app.json.ensure_ascii = False

    # Soporte para proxy reverso (Nginx / AWS Application Load Balancer)
    if os.getenv("BEHIND_PROXY", "1") == "1" or os.getenv("FLASK_ENV") == "production":
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    upload_folder = Path(app.config["UPLOAD_FOLDER"])
    (upload_folder / "videos").mkdir(parents=True, exist_ok=True)
    (upload_folder / "posters").mkdir(parents=True, exist_ok=True)
    (upload_folder / "posters" / "thumbs").mkdir(parents=True, exist_ok=True)

    db.init_app(app)

    @app.context_processor
    def inject_context():
        return {
            "csrf_token": generate_csrf_token(),
            "current_user": get_current_user(),
        }

    @app.before_request
    def handle_csrf_and_security():
        # Excluir archivos estáticos y endpoint de salud
        if request.endpoint == "static" or request.path.startswith("/static/"):
            return None
        if request.path == "/api/health":
            return None
        return verify_csrf()

    @app.errorhandler(413)
    def _too_large(_error):
        limit_mb = int(app.config["MAX_CONTENT_LENGTH"] / (1024 * 1024))
        if request.path.startswith("/api/") or request.is_json:
            return jsonify(error=f"El archivo supera el límite de {limit_mb} MB."), 413
        return (
            render_template(
                "error.html",
                code=413,
                message=f"El archivo supera el límite de {limit_mb} MB.",
            ),
            413,
        )

    @app.errorhandler(404)
    def _not_found(_error):
        if request.path.startswith("/api/"):
            return jsonify(error="Recurso no encontrado."), 404
        return (
            render_template(
                "error.html",
                code=404,
                message="La página o recurso que buscas no existe.",
            ),
            404,
        )

    @app.get("/api/health")
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            database = "ok"
        except OperationalError:
            database = "error"

        storage_mode = f"s3 ({app.config['S3_BUCKET_NAME']})" if app.config.get("S3_BUCKET_NAME") else "local"
        secrets_mode = f"secrets_manager ({app.config['AWS_SECRET_NAME']})" if app.config.get("AWS_SECRET_NAME") else "env"

        return jsonify(
            status="ok",
            database=database,
            storage=storage_mode,
            secrets_manager=secrets_mode,
            service="cine-plus",
        )

    from .routes import admin_bp, auth_bp, categories_bp, movies_bp, web_bp

    app.register_blueprint(web_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(movies_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        try:
            ensure_database(app.config["SQLALCHEMY_DATABASE_URI"])
            db.create_all()
            seed_defaults()
        except Exception as exc:
            app.logger.warning("Inicialización de BD completada con advertencia: %s", exc)

    return app
