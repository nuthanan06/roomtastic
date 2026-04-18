from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    account_created: Optional[datetime] = None
    last_logged_in: Optional[datetime] = None
    rooms: Optional[List[UUID]] = None
