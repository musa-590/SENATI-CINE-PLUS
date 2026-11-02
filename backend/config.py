from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

from .utils.secrets import fetch_aws_secret

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Cargar secretos opcionales desde AWS Secrets Manager
aws_secrets = fetch_aws_secret()


def _get_val(key: str, default: str = "") -> str:
    """Busca primero en AWS Secrets Manager, luego en variables de entorno, y finalmente usa el default."""
    if key in aws_secrets and aws_secrets[key] is not None:
        return str(aws_secrets[key])
    return os.getenv(key, default)


class Config:
    # AWS Settings
    AWS_REGION = _get_val("AWS_REGION", "us-east-1")
    AWS_SECRET_NAME = os.getenv("AWS_SECRET_NAME", "")
    S3_BUCKET_NAME = _get_val("S3_BUCKET_NAME", "")

    # Seguridad de sesión Flask
    SECRET_KEY = _get_val("SECRET_KEY", "cine-plus-dev-secret-change-me")
    SESSION_COOKIE_NAME = "cineplus_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = _get_val("SESSION_COOKIE_SECURE", "0") == "1"
    PERMANENT_SESSION_LIFETIME = timedelta(hours=int(_get_val("SESSION_HOURS", "12")))

    # Base de datos MySQL (Local o AWS RDS)
    SQLALCHEMY_DATABASE_URI = _get_val(
        "DATABASE_URL",
        "mysql+pymysql://root:@127.0.0.1:3307/cineplus?charset=utf8mb4",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    # Almacenamiento y límites de subida
    UPLOAD_FOLDER = BASE_DIR / "uploads"
    MAX_CONTENT_LENGTH = int(_get_val("MAX_UPLOAD_MB", "2048")) * 1024 * 1024

    # Plantillas y recarga en desarrollo
    TEMPLATES_AUTO_RELOAD = os.getenv("FLASK_ENV") != "production"
    SEND_FILE_MAX_AGE_DEFAULT = 86400

    # Credenciales iniciales del administrador
    ADMIN_NAME = _get_val("ADMIN_NAME", "Administrador")
    ADMIN_EMAIL = _get_val("ADMIN_EMAIL", "admin@cineplus.local")
    ADMIN_PASSWORD = _get_val("ADMIN_PASSWORD", "cineplus123")


# Sincronizar storage con la configuración de S3
try:
    from .services.storage import storage
    storage.bucket_name = Config.S3_BUCKET_NAME
    storage.region_name = Config.AWS_REGION
except Exception:
    pass
