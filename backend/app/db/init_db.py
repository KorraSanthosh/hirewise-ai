"""Create tables for a FRESH dev/test database only (e.g. SQLite).

Do NOT run against the existing Prisma-managed PostgreSQL database - it already has these tables.
Usage: DATABASE_URL=sqlite:///./dev.db python -m app.db.init_db
"""
from app import models  # noqa: F401  (register models)
from app.db.session import Base, engine

if __name__ == "__main__":
    if engine.dialect.name == "postgresql":
        raise SystemExit("Refusing to create tables on PostgreSQL: use the existing Prisma schema (see backend/README.md).")
    Base.metadata.create_all(engine)
    print("Tables created.")
