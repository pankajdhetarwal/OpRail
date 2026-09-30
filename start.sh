#!/bin/bash
# ============================================================================
# start.sh — OpRail Production Startup Script
# Runs Alembic migrations then starts Uvicorn.
# Used as the Docker CMD in production.
# ============================================================================

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║   OpRail — AI-Powered Block Planning System  ║"
echo "║   Starting production server...              ║"
echo "╚══════════════════════════════════════════════╝"

# ── Step 1: Run database migrations ────────────────────────────────────────
echo ""
echo "→ Running database migrations..."
python -m alembic upgrade head 2>&1 || {
    echo "⚠  Alembic migration failed (may not have any revisions yet)."
    echo "   Falling back to create_all_tables()..."
    python -c "
import app.models
from app.core.database import create_all_tables
create_all_tables()
print('   ✓ Tables created via SQLAlchemy metadata.')
"
}
echo "✓ Database ready."

# ── Step 2: Seed data if database is empty (first deploy) ──────────────────
echo ""
echo "→ Checking if data needs to be seeded..."
python -c "
from app.core.database import SessionLocal
from app.models.railway_section import RailwaySection
db = SessionLocal()
count = db.query(RailwaySection).count()
db.close()
if count == 0:
    print('   Database is empty — seeding initial data...')
    import subprocess, sys
    subprocess.run([sys.executable, 'data/generate_synthetic_data.py'], check=True)
    print('   ✓ Synthetic data seeded.')
else:
    print(f'   ✓ Database already has {count} sections. Skipping seed.')
"

# ── Step 3: Start Uvicorn ─────────────────────────────────────────────────
echo ""
echo "→ Starting Uvicorn on port ${PORT:-8080}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8080}" \
    --workers 2 \
    --log-level info
