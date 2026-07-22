import os
from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from fastapi_users.db import SQLAlchemyUserDatabase
from app.core.models import Base, User

dbPath : str = os.environ.get("AUTH_DB_PATH", "./test.db")

DATABASE_URL = f"sqlite+aiosqlite:///{dbPath}"

engine = create_async_engine(DATABASE_URL)

asyncSessionMaker = async_sessionmaker(engine, expire_on_commit=False)

async def createDbAndTables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def getAsyncSession() -> AsyncGenerator[AsyncSession, None]:
    async with asyncSessionMaker() as session:
        yield session

async def getUserDb(session : AsyncSession = Depends(getAsyncSession)):
    yield SQLAlchemyUserDatabase(session, User)