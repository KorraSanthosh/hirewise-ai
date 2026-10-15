"""Portable column types so the exact Prisma/Postgres tables map 1:1, while tests can run on SQLite."""
import json

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import TypeDecorator

from app.core.config import settings


class StringArray(TypeDecorator):
    """Prisma `String[]` -> Postgres text[]; JSON on other dialects."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(Text()))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        return list(value) if value is not None else []

    def process_result_value(self, value, dialect):
        return list(value) if value is not None else []


class VectorType(TypeDecorator):
    """Prisma `Unsupported("vector(768)")` -> pgvector; JSON text on other dialects."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(settings.EMBED_DIM))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        vals = [float(x) for x in value]
        return vals if dialect.name == "postgresql" else json.dumps(vals)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return json.loads(value)
        return [float(x) for x in value]
