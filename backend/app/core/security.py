import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

AUTH_SECRET = os.getenv("AUTH_SECRET", "change-me-in-production")
AUTH_ALGORITHM = "HS256"
AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "86400"))


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return pwd_context.verify(plain, hashed)


def issue_token(*, user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=AUTH_TOKEN_TTL_SECONDS),
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm=AUTH_ALGORITHM)


def verify_token(token: str) -> Optional[UUID]:
    try:
        data = jwt.decode(token, AUTH_SECRET, algorithms=[AUTH_ALGORITHM])
        sub = data.get("sub")
        if not sub:
            return None
        return UUID(sub)
    except JWTError:
        return None
