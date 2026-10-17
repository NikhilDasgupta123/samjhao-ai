from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

Username = Annotated[
    str,
    StringConstraints(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$"),
]


class AuthCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str | None = Field(default=None, min_length=1, max_length=320)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def require_identifier(self):
        if not self.identifier and not self.email:
            raise ValueError("Enter your email or username.")
        return self


class SignUpRequest(AuthCredentials):
    username: Username
    full_name: str | None = Field(default=None, min_length=1, max_length=120)


class AdminUserCreateRequest(SignUpRequest):
    """Credentials and profile fields for an admin-created user account."""


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: Username
    full_name: str | None
    role: Literal["user", "admin"]
    created_at: datetime


class RoleUpdateRequest(BaseModel):
    role: Literal["user", "admin"]
