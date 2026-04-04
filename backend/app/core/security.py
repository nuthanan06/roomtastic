import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

AUTH_SECRET = os.getenv("AUTH_SECRET", "change-me-in-production")
AUTH_ALGORITHM = "HS256"
AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "86400"))


def _bcrypt_bytes(plain: str) -> bytes:
    """Bcrypt ignores bytes beyond 72; newer bcrypt raises — truncate consistently."""
    b = plain.encode("utf-8")
    if len(b) > 72:
        return b[:72]
    return b


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_bcrypt_bytes(plain), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_bcrypt_bytes(plain), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False


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
