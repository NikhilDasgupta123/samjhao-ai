import argparse
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError

from auth.database import SessionLocal, engine
from auth.models import Base
from auth.services import DuplicateEmailError, create_admin_user


def create_admin() -> None:
    raw_email = input("Admin email: ").strip()
    password = getpass("Admin password (minimum 8 characters): ")
    confirmation = getpass("Confirm password: ")

    try:
        email = str(TypeAdapter(EmailStr).validate_python(raw_email)).lower()
    except ValidationError as exc:
        raise SystemExit("Enter a valid email address.") from exc
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters long.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as database:
        try:
            create_admin_user(database, email, password)
        except DuplicateEmailError as exc:
            raise SystemExit("An account with this email already exists.") from exc
    print(f"Admin account created for {email}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Samjhao backend administration commands")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create-admin", help="Create an admin account")
    args = parser.parse_args()

    if args.command == "create-admin":
        create_admin()


if __name__ == "__main__":
    main()
