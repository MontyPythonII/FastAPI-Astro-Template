from fastapi import APIRouter, Depends

# from app.api.routes import 
from app.api.users import authBackend, currentActiveUser, currentSuperuser, fastApiUsers
from app.api.schemas import UserCreate, UserRead, UserUpdate

api_router = APIRouter()

# api_router.include_router(router.router)


api_router.include_router(
    fastApiUsers.get_auth_router(authBackend),
    prefix="/auth/jwt",
    tags=["auth"]
)
api_router.include_router(
    fastApiUsers.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
    # dependencies=[Depends(currentSuperuser)]
)
api_router.include_router(
    fastApiUsers.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"]
)
api_router.include_router(
    fastApiUsers.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"]
)
api_router.include_router(
    fastApiUsers.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(currentActiveUser)]
)