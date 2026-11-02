from . import create_app
from .extensions import db
from .models import Category, Movie, User


def main() -> None:
    app = create_app()
    with app.app_context():
        print("Base de datos lista.")
        print(f"  Usuarios:    {User.query.count()}")
        print(f"  Categorías:  {Category.query.count()}")
        print(f"  Películas:   {Movie.query.count()}")
        print(f"  Motor:       {db.engine.url.drivername}")


if __name__ == "__main__":
    main()
