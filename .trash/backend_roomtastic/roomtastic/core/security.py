from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

from roomtastic.core.config import AUTH_SECRET, AUTH_TOKEN_TTL_SECONDS


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii"))


def hash_password(password: str) -> str:
    # PBKDF2-HMAC-SHA256 in stdlib; portable and dependency-free.
    salt = os.urandom(16)
    iterations = 210_000
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64url_encode(salt)}${_b64url_encode(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, it_s, salt_s, dk_s = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(it_s)
        salt = _b64url_decode(salt_s)
        dk = _b64url_decode(dk_s)
        test = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(test, dk)
    except Exception:
        return False


@dataclass(frozen=True)
class TokenClaims:
    sub: str
    exp: int


def issue_token(user_id: str, now: int | None = None) -> str:
    now_i = int(time.time()) if now is None else int(now)
    claims = {"sub": user_id, "exp": now_i + AUTH_TOKEN_TTL_SECONDS}
    payload = json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(AUTH_SECRET.encode("utf-8"), payload, hashlib.sha256).digest()
    return f"{_b64url_encode(payload)}.{_b64url_encode(sig)}"


def verify_token(token: str, now: int | None = None) -> TokenClaims | None:
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        payload = _b64url_decode(payload_b64)
        sig = _b64url_decode(sig_b64)
        expected = hmac.new(AUTH_SECRET.encode("utf-8"), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(payload.decode("utf-8"))
        exp = int(data.get("exp", 0))
        sub = str(data.get("sub", ""))
        now_i = int(time.time()) if now is None else int(now)
        if not sub or exp <= now_i:
            return None
        return TokenClaims(sub=sub, exp=exp)
    except Exception:
        return None

