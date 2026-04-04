from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthLogin, AuthRegister, AuthToken, AuthMe
from app.schemas.user import UserCreate, UserOut
from app.core.security import verify_password, issue_token
from app.controllers import user_controller as user_ctrl
from app.api.serialize import user_to_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(body: AuthRegister, db: Session = Depends(get_db)):
    uc = UserCreate(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        password=body.password,
    )
    user = user_ctrl.create_user(db, uc)
    return user_to_out(user)


@router.post("/login", response_model=AuthToken)
def login(body: AuthLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash or ""):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.last_loged_in = datetime.utcnow()
    db.add(user)
    db.commit()
    token = issue_token(user_id=user.user_id)
    return AuthToken(access_token=token)


@router.get("/me", response_model=AuthMe)
def me(user: User = Depends(get_current_user)):
    return AuthMe(
        user_id=str(user.user_id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )
