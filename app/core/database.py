"""
app/core/database.py — SQLAlchemy engine + session factory
Works with both SQLite (dev) and PostgreSQL (production).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# SQLite needs check_same_thread=False; PostgreSQL does not need it
connect_args = {"check_same_thread": False} if settings.database_url_fixed.startswith("sqlite") else {}

engine = create_engine(settings.database_url_fixed, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: gives each request its own DB session, always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Create all tables defined under Base. Called once at startup."""
    Base.metadata.create_all(bind=engine)
