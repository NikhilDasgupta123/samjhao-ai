import argparse
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError

from auth.database import SessionLocal, initialize_auth_database
from auth.schemas import Username
from auth.services import DuplicateAccountError, create_admin_user


def create_admin() -> None:
    raw_email = input("Admin email: ").strip()
    raw_username = input("Admin username (3-32 letters, numbers, dots, dashes, or underscores): ").strip()
    password = getpass("Admin password (minimum 8 characters): ")
    confirmation = getpass("Confirm password: ")

    try:
        email = str(TypeAdapter(EmailStr).validate_python(raw_email)).lower()
    except ValidationError as exc:
        raise SystemExit("Enter a valid email address.") from exc
    try:
        username = str(TypeAdapter(Username).validate_python(raw_username)).lower()
    except ValidationError as exc:
        raise SystemExit("Enter a valid username.") from exc
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters long.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    initialize_auth_database()
    with SessionLocal() as database:
        try:
            create_admin_user(database, email, username, password)
        except DuplicateAccountError as exc:
            raise SystemExit("The email or username is already in use.") from exc
    print(f"Admin account created for {email} (@{username}).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Samjhao backend administration commands")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create-admin", help="Create an admin account")
    args = parser.parse_args()

    if args.command == "create-admin":
        create_admin()


if __name__ == "__main__":
    main()
