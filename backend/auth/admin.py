from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from auth.dependencies import AdminUser, DatabaseSession
from auth.models import User
from auth.schemas import RoleUpdateRequest, UserResponse

router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("/users", response_model=list[UserResponse])
def list_users(_admin: AdminUser, database: DatabaseSession):
    return list(database.scalars(select(User).order_by(User.created_at.desc())))


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    payload: RoleUpdateRequest,
    _admin: AdminUser,
    database: DatabaseSession,
):
    user = database.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.role == "admin" and payload.role == "user":
        admin_count = database.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0
        if admin_count <= 1:
            raise HTTPException(status_code=409, detail="The last admin cannot be demoted.")

    user.role = payload.role
    database.commit()
    database.refresh(user)
    return user
