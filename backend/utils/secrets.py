from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger("cineplus.secrets")


def fetch_aws_secret(
    secret_name: str | None = None,
    region_name: str | None = None,
) -> dict[str, Any]:
    """Obtiene los secretos en formato JSON desde AWS Secrets Manager.

    Si no se especifica nombre de secreto, se lee de la variable AWS_SECRET_NAME.
    Si boto3 no está disponible o la llamada falla (por ejemplo, en desarrollo local),
    devuelve un diccionario vacío sin detener la aplicación.
    """
    target_secret = secret_name or os.getenv("AWS_SECRET_NAME")
    if not target_secret:
        return {}

    target_region = region_name or os.getenv("AWS_REGION", "us-east-1")

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError:
        logger.warning(
            "boto3 no está instalado. No se pueden consultar secretos de AWS Secrets Manager."
        )
        return {}

    try:
        session = boto3.session.Session()
        client = session.client(
            service_name="secretsmanager",
            region_name=target_region,
        )
        response = client.get_secret_value(SecretId=target_secret)
        secret_string = response.get("SecretString")

        if not secret_string:
            logger.warning("El secreto '%s' no contiene SecretString.", target_secret)
            return {}

        data = json.loads(secret_string)
        if isinstance(data, dict):
            logger.info("Secretos cargados exitosamente desde AWS Secrets Manager: %s", target_secret)
            return data
        logger.warning("El contenido del secreto '%s' no es un objeto JSON.", target_secret)
        return {}
    except (BotoCoreError, ClientError) as exc:
        logger.warning(
            "No se pudo obtener el secreto '%s' desde AWS Secrets Manager: %s. Se usarán variables de entorno locales.",
            target_secret,
            exc,
        )
        return {}
    except json.JSONDecodeError as exc:
        logger.warning(
            "El secreto '%s' no contiene un JSON válido: %s",
            target_secret,
            exc,
        )
        return {}
