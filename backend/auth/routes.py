from fastapi import APIRouter, HTTPException, Request, Response, status

from app.core.settings import settings
from auth.dependencies import CurrentUser, DatabaseSession
from auth.schemas import LoginRequest, SignUpRequest, UserResponse
from auth.services import DuplicateAccountError, authenticate_user, register_user, revoke_session

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.auth_session_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite_value,
        path="/",
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def sign_up(payload: SignUpRequest, response: Response, database: DatabaseSession):
    try:
        user, token = register_user(database, payload)
    except DuplicateAccountError as exc:
        raise HTTPException(status_code=409, detail="Email or username is already in use.") from exc
    _set_session_cookie(response, token)
    return user


@router.post("/login", response_model=UserResponse)
def log_in(payload: LoginRequest, response: Response, database: DatabaseSession):
    identifier = payload.identifier or str(payload.email or "")
    result = authenticate_user(database, identifier, payload.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Email/username or password is incorrect.")
    user, token = result
    _set_session_cookie(response, token)
    return user


@router.get("/me", response_model=UserResponse)
def get_me(user: CurrentUser):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def log_out(request: Request, response: Response, database: DatabaseSession, _user: CurrentUser):
    revoke_session(database, request.cookies.get(settings.auth_cookie_name))
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite_value,
        path="/",
    )
