# Backend image: FastAPI + uvicorn on a slim Python base, with dependencies
# resolved from the committed uv.lock so rebuilds are byte-for-byte repeatable.

FROM python:3.13-slim-bookworm

# Pinned uv binary. Pinning keeps rebuilds reproducible months from now.
COPY --from=ghcr.io/astral-sh/uv:0.11.21 /uv /usr/local/bin/uv

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    SERVER_PORT=7070

# Dependencies as their own layer: source edits below this line will not
# trigger a full reinstall on rebuild.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY main.py ./
COPY app ./app

# Run unprivileged. /data is created and chowned here so that the named
# volume mounted over it inherits appuser ownership — without this, SQLite
# fails at startup with "unable to open database file".
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
USER appuser

# Venv on PATH so we call uvicorn directly, with no `uv run` re-sync attempt
# every time the container starts.
ENV PATH="/app/.venv/bin:$PATH"

# Documentation only, and fixed at build time — the runtime port comes from
# SERVER_PORT below, which compose overrides per-deployment.
EXPOSE 7070

# Wrapped in sh so SERVER_PORT expands at container start rather than being
# frozen into the image; `exec` hands PID 1 back to uvicorn so it still
# receives SIGTERM directly and shuts down gracefully on `compose down`.
# No --reload here; main.py's reload=True is a development-only convenience.
CMD ["sh", "-c", "exec uvicorn app.app:app --host 0.0.0.0 --port ${SERVER_PORT:-7070}"]
