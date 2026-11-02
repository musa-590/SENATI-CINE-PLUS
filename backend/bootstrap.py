"""Crea la base de datos MySQL si todavía no existe.

Compatible tanto con entornos locales (XAMPP / MySQL portátil) como con AWS RDS.
"""

from __future__ import annotations

import os
import time

import pymysql
from sqlalchemy.engine import make_url


def ensure_database(database_uri: str, retries: int = 15, delay: float = 1.0) -> None:
    if os.getenv("SKIP_DB_BOOTSTRAP", "0") == "1":
        return

    url = make_url(database_uri)
    if not url.drivername.startswith("mysql"):
        return

    database = url.database
    if not database:
        raise RuntimeError("DATABASE_URL no incluye el nombre de la base de datos.")

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        # 1. Probar primero si la base de datos ya existe y se puede conectar directamente (caso RDS)
        try:
            direct_conn = pymysql.connect(
                host=url.host or "127.0.0.1",
                port=url.port or 3306,
                user=url.username or "root",
                password=url.password or "",
                database=database,
                charset="utf8mb4",
                connect_timeout=4,
            )
            direct_conn.close()
            return
        except pymysql.MySQLError as exc:
            # Si el error es 1049 (Unknown database), intentaremos crearla abajo.
            # Si es de autenticación u otro fallo de red, guardamos el error para reintentar.
            last_error = exc

        # 2. Si no existe, intentar conectarse al servidor para crearla (caso entorno local)
        try:
            connection = pymysql.connect(
                host=url.host or "127.0.0.1",
                port=url.port or 3306,
                user=url.username or "root",
                password=url.password or "",
                charset="utf8mb4",
                autocommit=True,
                connect_timeout=4,
            )
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        f"CREATE DATABASE IF NOT EXISTS `{database}` "
                        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                    )
            finally:
                connection.close()
            return
        except pymysql.MySQLError as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(delay)

    raise RuntimeError(
        "No se pudo conectar o inicializar MySQL en "
        f"{url.host or '127.0.0.1'}:{url.port or 3306}. "
        "Revisa DATABASE_URL o la conectividad con RDS. "
        f"Detalle: {last_error}"
    )
