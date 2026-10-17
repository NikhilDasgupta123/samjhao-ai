import re
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def initialize_auth_database() -> None:
    """Create auth tables and backfill usernames for accounts from the prior schema."""
    from auth.models import Base

    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("users")}
        if "username" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(32)"))

        existing_usernames = set(
            connection.scalars(text("SELECT username FROM users WHERE username IS NOT NULL"))
        )
        users_without_username = connection.execute(
            text("SELECT id, email FROM users WHERE username IS NULL OR username = ''")
        ).mappings().all()
        for user in users_without_username:
            base = re.sub(r"[^a-z0-9_.-]+", "_", user["email"].split("@", 1)[0].lower()).strip("_.-")
            base = base or "user"
            suffix = f"_{user['id']}"
            username = f"{base[:32 - len(suffix)]}{suffix}"
            counter = 1
            while username in existing_usernames:
                suffix = f"_{user['id']}_{counter}"
                username = f"{base[:32 - len(suffix)]}{suffix}"
                counter += 1
            connection.execute(
                text("UPDATE users SET username = :username WHERE id = :user_id"),
                {"username": username, "user_id": user["id"]},
            )
            existing_usernames.add(username)

        connection.execute(text("ALTER TABLE users ALTER COLUMN username SET NOT NULL"))
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
        )


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for one API request."""
    database = SessionLocal()
    try:
        yield database
    finally:
        database.close()
