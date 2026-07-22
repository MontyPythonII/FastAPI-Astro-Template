from fastapi import FastAPI
from app.api.router import api_router
from app.api.bootstrap import createFirstSuperuser
from app.core.db import createDbAndTables
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app : FastAPI):
    await createDbAndTables()
    # Must follow table creation: the seed writes into those tables.
    await createFirstSuperuser()
    yield

app = FastAPI(lifespan=lifespan)

# Liveness probe for the container healthcheck. Deliberately unauthenticated
# and free of database or scraper work, so it stays cheap and always
# answerable — the data routes require a bearer token and cannot serve here.
@app.get("/health")
async def healthCheck() -> dict[str, str]:
    return {"status" : "ok"}

app.include_router(api_router)