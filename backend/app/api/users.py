import uuid
import os
from typing import Optional
from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy
)
from fastapi_users.db import SQLAlchemyUserDatabase
from app.core.models import User
from app.core.db import getUserDb
# from app.api.users import authBackend, currentActiveUser, fastApiUsers

SECRET : str = os.environ.get("AUTH_SECRET", "SECRET")

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user : User, request : Optional[Request] = None):
        print(f"User {user.id} has registered.")

async def getUserManager(userDb : SQLAlchemyUserDatabase = Depends(getUserDb)):
    yield UserManager(userDb)

bearerTransport = BearerTransport(tokenUrl="auth/jwt/login")

def getJwtStrategy():
    return JWTStrategy(secret=SECRET, lifetime_seconds=2 * 24 * 60 * 60)

authBackend = AuthenticationBackend(
    name="jwt",
    transport=bearerTransport,
    get_strategy=getJwtStrategy
)

fastApiUsers = FastAPIUsers[User, uuid.UUID](getUserManager, auth_backends=[authBackend])

currentActiveUser = fastApiUsers.current_user(active=True)

currentSuperuser = fastApiUsers.current_user(active=True, superuser=True)