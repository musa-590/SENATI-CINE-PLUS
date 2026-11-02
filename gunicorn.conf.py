# ==============================================================================
# Gunicorn Configuration for AWS EC2 Deployment
# ==============================================================================

import multiprocessing
import os

# Dirección y puerto de escucha
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:5000")

# En instancias t2.micro / t3.micro (1 vCPU, 1 GB RAM):
# 2 workers con 2 threads cada uno ofrecen un balance perfecto de memoria y concurrencia.
workers = int(os.getenv("GUNICORN_WORKERS", 2))
threads = int(os.getenv("GUNICORN_THREADS", 2))
worker_class = "gthread"

# Timeout holgado para subidas de vídeos grandes
timeout = int(os.getenv("GUNICORN_TIMEOUT", 180))
keepalive = 5

# Logs a consola (capturados por systemd / journalctl)
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

# Reciclaje periódico de procesos para evitar fugas de memoria en instancias pequeñas
max_requests = 1000
max_requests_jitter = 50
