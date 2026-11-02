# CINE PLUS · Plataforma de Tráilers Cinematográficos
> **Proyecto Final - Desarrollo y Despliegue en la Nube (AWS)**  
> **Institución:** SENATI  
> **Arquitectura:** Python Flask + MySQL + Vanilla JS (SSR) | **Nube:** AWS (EC2, VPC, RDS, S3, Secrets Manager)

---

## 1. Descripción del Proyecto

**Cine Plus** es una plataforma web para la visualización y gestión de tráilers cinematográficos de alto rendimiento. Ha sido diseñada con un enfoque nativo y desacoplado, combinando renderizado inicial del lado del servidor (**SSR**) con módulos web interactivos en el cliente, y una infraestructura en la nube elástica y segura desplegada sobre **Amazon Web Services (AWS)**.

### Características Principales:
* **Cartelera Pública Interactiva:** Catálogo filtrable por categorías y buscador instantáneo en tiempo real.
* **Reproductor con Streaming por Rangos (HTTP 206):** Reproducción de vídeo sin latencia, permitiendo saltar a cualquier punto del tráiler mediante URLs prefirmadas seguras de Amazon S3.
* **Carrusel Líquido 3D & Efectos WebGL:** Experiencia inmersiva en portada desarrollada con OGL nativo sin dependencias pesadas de librerías externas.
* **Miniaturas Dinámicas WebP:** Optimización y compresión bajo demanda con Pillow para máxima velocidad de carga.
* **Panel Administrativo Protegido:** Autenticación basada en sesiones seguras `HttpOnly`, protección contra ataques **CSRF**, y gestión completa (CRUD) de películas y categorías con barra de progreso de subida.

---

## 2. Arquitectura de Despliegue en AWS

El proyecto implementa una infraestructura segura y desacoplada en la nube utilizando la capa de **AWS Academy**:

```text
                               INTERNET
                                  │ (HTTP :80 / HTTPS, SSH :22)
                                  ▼
                         [ Internet Gateway ]
                                  │
┌── VPC: 10.0.0.0/16 (vpc-cineplus) ──────────────────────────────────────────────┐
│                                                                                 │
│  [ Subred Pública - 10.0.1.0/24 ]                                               │
│    └── Amazon EC2 (Ubuntu 24.04 LTS / t2.micro)                                 │
│          ├── Nginx (Reverse Proxy :80 con soporte para subidas de 2GB)          │
│          ├── Gunicorn (Servidor WSGI multihilo para producción)                 │
│          ├── IAM Instance Profile: LabRole (Acceso sin claves hardcodeadas)     │
│          ├── Security Group: sg-cineplus-ec2                                    │
│          │                                                                      │
│          ├──► Consulta credenciales ──► [ AWS Secrets Manager ]                 │
│          └──► Subidas y Streaming  ───► [ Amazon S3 Bucket ]                    │
│                                                                                 │
│  [ Subredes Privadas RDS - 10.0.10.0/24 y 10.0.11.0/24 ]                       │
│    └── Amazon RDS (MySQL 8 - db.t3.micro)                                       │
│          ├── Base de datos: cineplus                                            │
│          └── Security Group: sg-cineplus-rds (Puerto 3306 aislado para la EC2)  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Roles de los Servicios AWS Implementados:

1. **Amazon EC2:** Servidor virtual donde se ejecuta la lógica backend mediante **Gunicorn** expuesto a través de **Nginx** como Proxy Reverso.
2. **Amazon VPC:** Red virtual aislada con dos zonas de disponibilidad (AZ), con subredes públicas para la aplicación web y subredes privadas protegidas para la base de datos.
3. **AWS Secrets Manager:** Gestión centralizada y cifrada de las credenciales de la base de datos (`DATABASE_URL`), `SECRET_KEY` y configuraciones, leídas en tiempo de ejecución mediante el SDK oficial `boto3`.
4. **Amazon RDS (MySQL 8):** Servicio de base de datos relacional administrada, restringida exclusivamente al tráfico originado por el Security Group de la EC2 (`sg-cineplus-ec2`).
5. **Amazon S3:** Repositorio de objetos para almacenar vídeos y pósters. La aplicación genera **Presigned URLs** seguras, delegando la transferencia pesada de vídeo directamente a S3 para no saturar la máquina virtual.

---

## 3. Stack Tecnológico

* **Backend:** Python 3.11+, Flask 3.1, Flask-SQLAlchemy 3.1.
* **Conectores y Nube:** PyMySQL, Cryptography, Boto3 (AWS SDK).
* **WSGI & Servidor:** Gunicorn 22+, Nginx.
* **Procesamiento Multimedia:** Pillow (generación de miniaturas WebP).
* **Frontend:** HTML5 semántico, CSS3 moderno, JavaScript nativo (ESM) y WebGL (OGL).

---

## 4. Estructura del Repositorio

```text
├── backend/
│   ├── app.py                     # Punto de entrada de la aplicación
│   ├── config.py                  # Configuración integrada con AWS Secrets Manager
│   ├── extensions.py              # Inicialización de SQLAlchemy
│   ├── models.py                  # Modelos relacionales (User, Category, Movie)
│   ├── security.py                # Sesiones HttpOnly y validación de tokens CSRF
│   ├── requirements.txt           # Dependencias Python
│   ├── services/
│   │   ├── movie_service.py       # Lógica de consultas y catálogo
│   │   └── storage.py             # Adaptador de almacenamiento dual (S3 / Local)
│   ├── routes/                    # Controladores modularizados (Web, API, Auth, Películas)
│   ├── templates/                 # Vistas HTML con renderizado del servidor (SSR)
│   ├── static/                    # Módulos JS nativos, CSS y shaders WebGL
│   └── utils/
│       ├── secrets.py             # Cliente de conexión a AWS Secrets Manager
│       └── streaming.py           # Soporte de streaming con HTTP Range
├── gunicorn.conf.py               # Ajustes de workers e hilos de Gunicorn para EC2
├── README.md                      # Documentación general
└── .gitignore                     # Exclusión de archivos sensibles y temporales
```

---

## 5. Guía Rápida de Despliegue en AWS EC2

### 1. Clonar el repositorio en la instancia EC2
Conéctate por SSH o mediante **EC2 Instance Connect** a tu máquina virtual y ejecuta:

```bash
git clone https://github.com/musa-590/SENATI-CINE-PLUS.git ~/TrabajFinal
cd ~/TrabajFinal
```

### 2. Configurar las variables de entorno
Crea el archivo `backend/.env` indicando el secreto de Secrets Manager y tu bucket de S3:

```bash
cat << 'EOF' > backend/.env
FLASK_ENV=production
AWS_SECRET_NAME=cineplus/production
AWS_REGION=us-east-1
S3_BUCKET_NAME=tu-bucket-s3
BEHIND_PROXY=1
SKIP_DB_BOOTSTRAP=1
EOF
```

### 3. Instalar dependencias y arrancar
Instala los paquetes necesarios del sistema y el entorno virtual:

```bash
sudo apt update -y && sudo apt install -y python3-pip python3-venv nginx
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

Inicia la aplicación con Gunicorn en producción:

```bash
gunicorn -c gunicorn.conf.py "backend:create_app()"
```

---

## 6. Verificación del Despliegue

Puedes comprobar el estado de salud de los servicios integrados accediendo al endpoint `/api/health`:

```bash
curl http://localhost/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "database": "ok",
  "secrets_manager": "secrets_manager (cineplus/production)",
  "storage": "s3 (tu-bucket-s3)",
  "service": "cine-plus"
}
```

---

## 7. Ejecución en Entorno Local (Desarrollo)

Si deseas ejecutar el proyecto localmente sin conexión a AWS:

1. **Activar entorno virtual e instalar dependencias:**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # En Windows: .\.venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   ```
2. **Configurar `backend/.env` con tu base de datos local:**
   ```ini
   DATABASE_URL=mysql+pymysql://root:@127.0.0.1:3306/cineplus?charset=utf8mb4
   SECRET_KEY=clave-local-desarrollo
   ```
3. **Iniciar el servidor:**
   ```bash
   python -m backend.app
   ```
   La aplicación estará disponible en `http://127.0.0.1:5000/`.
