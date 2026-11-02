import os

from . import create_app

app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))
    production = os.getenv("PRODUCTION") == "1"
    app.run(host=host, port=port, debug=not production, use_reloader=not production)
