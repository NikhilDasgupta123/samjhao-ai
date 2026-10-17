from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.settings import settings
from auth.models import AuthSession, User
from auth.schemas import SignUpRequest
from auth.security import create_session_token, hash_password, hash_session_token, verify_password


class DuplicateAccountError(Exception):
    pass


def _create_session(database: Session, user: User) -> str:
    token = create_session_token()
    database.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_session_token(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.auth_session_days),
        )
    )
    return token


def register_user(database: Session, payload: SignUpRequest) -> tuple[User, str]:
    user = User(
        email=str(payload.email).strip().lower(),
        username=payload.username.strip().lower(),
        full_name=payload.full_name.strip() if payload.full_name else None,
        password_hash=hash_password(payload.password),
        role="user",
    )
    database.add(user)
    try:
        database.flush()
        token = _create_session(database, user)
        database.commit()
    except IntegrityError as exc:
        database.rollback()
        raise DuplicateAccountError from exc
    return user, token


def create_user_account(database: Session, payload: SignUpRequest) -> User:
    """Create a regular account from the admin panel without signing it in."""
    user = User(
        email=str(payload.email).strip().lower(),
        username=payload.username.strip().lower(),
        full_name=payload.full_name.strip() if payload.full_name else None,
        password_hash=hash_password(payload.password),
        role="user",
    )
    database.add(user)
    try:
        database.commit()
        database.refresh(user)
    except IntegrityError as exc:
        database.rollback()
        raise DuplicateAccountError from exc
    return user


def authenticate_user(database: Session, identifier: str, password: str) -> tuple[User, str] | None:
    normalized_identifier = identifier.strip().lower()
    user = database.scalar(
        select(User).where(
            or_(User.email == normalized_identifier, User.username == normalized_identifier)
        )
    )
    if user is None or not verify_password(password, user.password_hash) or not user.is_active:
        return None

    token = _create_session(database, user)
    database.commit()
    return user, token


def revoke_session(database: Session, token: str | None) -> None:
    if not token:
        return
    auth_session = database.scalar(
        select(AuthSession).where(AuthSession.token_hash == hash_session_token(token))
    )
    if auth_session is not None:
        database.delete(auth_session)
        database.commit()


def create_admin_user(database: Session, email: str, username: str, password: str) -> User:
    user = User(
        email=email.strip().lower(),
        username=username.strip().lower(),
        password_hash=hash_password(password),
        role="admin",
    )
    database.add(user)
    try:
        database.commit()
    except IntegrityError as exc:
        database.rollback()
        raise DuplicateAccountError from exc
    return user
