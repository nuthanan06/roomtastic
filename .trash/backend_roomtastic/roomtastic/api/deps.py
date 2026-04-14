from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from roomtastic.core.security import verify_token
from roomtastic.db.models import User
from roomtastic.db.session import get_session


def get_current_user(
    session: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    claims = verify_token(token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = session.get(User, claims.sub)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

