# ============================================================================
# OpRail — Multi-Stage Dockerfile for Fly.io
# Stage 1: Build React frontend with Vite
# Stage 2: Python backend (FastAPI + OR-Tools + XGBoost)
# ============================================================================

# ── Stage 1: Frontend Build ────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build

# Copy only package files first (cache-friendly)
COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci --no-audit --no-fund

# Copy rest of frontend source
COPY frontend/ ./

# Build → outputs to ../static (per vite.config.ts)
# Override outDir to /build/dist so we can COPY it cleanly
RUN npx vite build --outDir /build/dist


# ── Stage 2: Python Backend ────────────────────────────────────────────────
FROM python:3.11-slim AS production

# Prevent Python from writing .pyc files & enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install system dependencies needed by psycopg2-binary and OR-Tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cache-friendly — changes less often)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini .
COPY data/ ./data/
COPY scripts/ ./scripts/

# Copy trained ML models
COPY models/ ./models/

# Copy the built frontend from Stage 1
COPY --from=frontend-builder /build/dist ./static/

# Copy static assets that aren't part of the Vite build (favicon, icons)
COPY static/favicon.svg ./static/favicon.svg
COPY static/icons.svg ./static/icons.svg

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

# Expose the port Fly.io expects
EXPOSE 8080

# Health check for Fly.io
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

# Run startup script (migrations → seed → uvicorn)
CMD ["./start.sh"]
