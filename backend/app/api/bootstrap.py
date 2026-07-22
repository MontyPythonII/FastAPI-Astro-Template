"""
Ensures the initial superuser account exists at startup, from environment
variables.

A fresh deployment starts with an empty database, so there is no way to obtain
the first privileged account through the API without leaving registration open
to anyone. Seeding it from credentials handed to the container avoids that,
and keeps those credentials out of source control.
"""

import os

from fastapi_users.db import SQLAlchemyUserDatabase

from app.api.schemas import UserCreate
from app.api.users import UserManager
from app.core.db import asyncSessionMaker
from app.core.models import User


async def createFirstSuperuser() -> None:
    email : str = os.environ.get("FIRST_SUPERUSER", "").strip()
    password : str = os.environ.get("FIRST_SUPERUSER_PASSWORD", "").strip()

    # Absent credentials mean "do not seed" — local development runs without
    # them and is left untouched.
    if not email or not password:
        return

    async with asyncSessionMaker() as session:
        userDb = SQLAlchemyUserDatabase(session, User)
        userManager = UserManager(userDb)

        existing : User | None = await userDb.get_by_email(email)

        if existing is None:
            await userManager.create(
                UserCreate(
                    email=email,
                    password=password,
                    is_superuser=True,
                    is_verified=True
                )
            )
            print(f"Seeded first superuser: {email}")
            return

        # The account already exists — registered by hand, or created before
        # this setting was introduced. Grant the flag so the variable is
        # authoritative on every boot, but never touch the stored password:
        # rotating it silently on restart would be a nasty surprise, and the
        # password is the account holder's to change through the API.
        if not existing.is_superuser:
            await userDb.update(existing, {"is_superuser" : True})
            print(f"Promoted existing account to superuser: {email}")
