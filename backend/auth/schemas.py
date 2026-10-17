from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AuthCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SignUpRequest(AuthCredentials):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    role: Literal["user", "admin"]
    created_at: datetime


class RoleUpdateRequest(BaseModel):
    role: Literal["user", "admin"]
