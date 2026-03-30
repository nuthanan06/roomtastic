from pydantic import BaseModel, EmailStr


class AuthRegister(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthMe(BaseModel):
    user_id: str
    email: str
    first_name: str
    last_name: str
