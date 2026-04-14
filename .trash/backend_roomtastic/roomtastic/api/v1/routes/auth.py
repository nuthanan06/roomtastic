from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from roomtastic.api.deps import get_current_user
from roomtastic.api.v1.schemas import AuthLogin, AuthToken, UserCreate, UserOut
from roomtastic.core.security import hash_password, issue_token, verify_password
from roomtastic.db.models import User
from roomtastic.db.session import get_session

router = APIRouter()

def _user_out(u: User) -> UserOut:
    return UserOut(
        user_id=u.user_id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        account_created=u.account_created,
        last_logged_in=u.last_logged_in,
    )


@router.post("/register", response_model=AuthToken)
def register(payload: UserCreate, session: Session = Depends(get_session)):
    existing = session.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    u = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        account_created=datetime.utcnow(),
        last_logged_in=datetime.utcnow(),
    )
    session.add(u)
    session.commit()
    session.refresh(u)
    token = issue_token(u.user_id)
    return AuthToken(token=token, user=_user_out(u))


@router.post("/login", response_model=AuthToken)
def login(payload: AuthLogin, session: Session = Depends(get_session)):
    u = session.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    if not u or not verify_password(payload.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    u.last_logged_in = datetime.utcnow()
    session.add(u)
    session.commit()
    token = issue_token(u.user_id)
    return AuthToken(token=token, user=_user_out(u))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)
