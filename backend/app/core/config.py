from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    # The repo-root .env (used by the old Next.js app) is read first, backend/.env overrides it.
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_DIR / ".env"), str(BACKEND_DIR / ".env")), extra="ignore"
    )

    DATABASE_URL: str = "sqlite:///./hirewise_dev.db"
    JWT_SECRET: str = ""
    NEXTAUTH_SECRET: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODELS: str = "gemini-3.5-flash,gemini-3.1-flash-lite,gemini-flash-latest"  # comma-separated backup models tried when the main one is overloaded
    GEMINI_EMBED_MODEL: str = "gemini-embedding-001"
    EMBED_DIM: int = 768
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    SCORING_CONFIG: str = str(BACKEND_DIR / "app" / "config" / "scoring_config.json")
    UPLOAD_DIR: str = str(BACKEND_DIR / "uploads")  # profile photos live here (no database change needed)
    FRONTEND_DIST: str = str(ROOT_DIR / "frontend" / "dist")

    @property
    def secret(self) -> str:
        return self.JWT_SECRET or self.NEXTAUTH_SECRET or "dev-insecure-secret-change-me"

    @property
    def sqlalchemy_url(self) -> str:
        """Normalise a Prisma-style URL for SQLAlchemy/psycopg2."""
        url = self.DATABASE_URL.strip().strip('"').strip("'")
        parts = urlsplit(url)
        scheme = parts.scheme
        if scheme not in ("postgres", "postgresql"):
            return url
        scheme = "postgresql+psycopg2"
        # Prisma-only query params (schema=public, connection_limit, pgbouncer...) are not valid libpq options
        prisma_only = {"schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"}
        query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k not in prisma_only])
        return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))

    @property
    def cors_origins(self) -> list:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
