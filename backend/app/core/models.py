from sqlalchemy import UUID, Column, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase, relationship
from fastapi_users.db import SQLAlchemyBaseUserTableUUID

class Base(DeclarativeBase):
    pass

class User(SQLAlchemyBaseUserTableUUID, Base):
    pass