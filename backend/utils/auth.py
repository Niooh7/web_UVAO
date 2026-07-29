import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext

from ..config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES, ADMIN_LOGINS

logger = logging.getLogger(__name__)

_bcrypt = CryptContext(schemes=['bcrypt'], deprecated='auto')
_bearer = HTTPBearer()


# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash with bcrypt (used for new/updated passwords)."""
    return _bcrypt.hash(password)


def _sha256(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain: str, stored: str) -> bool:
    """
    Verify against bcrypt or legacy SHA-256.
    Uses constant-time comparison for SHA-256 to prevent timing attacks.
    """
    if stored.startswith('$2'):
        return _bcrypt.verify(plain, stored)
    return hmac.compare_digest(_sha256(plain), stored)


def migrate_to_bcrypt(plain: str) -> str:
    """Return bcrypt hash for transparent migration from SHA-256 on login."""
    return _bcrypt.hash(plain)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, login: str, is_admin: bool) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        'sub':      str(user_id),
        'login':    login,
        'is_admin': is_admin,
        'exp':      expire,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Недействительный или истёкший токен',
            headers={'WWW-Authenticate': 'Bearer'},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    return _decode_token(credentials.credentials)


def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get('is_admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Недостаточно прав',
        )
    return user


# ── Legacy helper (kept for ADMIN_LOGINS check at login time) ─────────────────

def verify_admin(login: str) -> bool:
    return login in ADMIN_LOGINS
