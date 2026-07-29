import logging
import sqlite3

from fastapi import APIRouter, HTTPException, Request

from ..config import DATABASE_PATH
from ..utils.auth import verify_password, migrate_to_bcrypt, create_access_token, verify_admin
from ..utils.limiter import limiter
from .schemas import LoginBody

logger = logging.getLogger(__name__)
router = APIRouter()

_DUMMY_HASH = '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'


@router.post('/api/auth/login')
@limiter.limit('10/minute')
def login_endpoint(request: Request, body: LoginBody):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT u.ID, u.Name, o.Org_name, d.Duty_name, u.Login, u.Password
            FROM Users u
            LEFT JOIN Organizations o ON u.ID_organization = o.ID_organization
            LEFT JOIN Dutys d ON u.ID_duty = d.ID_duty
            WHERE u.Login = ?
        """, (body.login,))
        row = cursor.fetchone()

        # Always run verify to prevent timing-based user enumeration
        stored = row[5] if row else _DUMMY_HASH
        if not verify_password(body.password, stored) or row is None:
            raise HTTPException(status_code=401, detail='Неверный логин или пароль')

        user_id, name, org, duty, db_login, stored_hash = row

        # Transparent migration: SHA-256 → bcrypt on first successful login
        if not stored_hash.startswith('$2'):
            new_hash = migrate_to_bcrypt(body.password)
            cursor.execute('UPDATE Users SET Password = ? WHERE ID = ?', (new_hash, user_id))
            conn.commit()

        is_admin = verify_admin(db_login)
        token = create_access_token(user_id, db_login, is_admin)

        return {
            'access_token': token,
            'token_type':   'bearer',
            'user': {
                'id':           user_id,
                'name':         name,
                'organization': org,
                'duty':         duty,
                'login':        db_login,
                'is_admin':     is_admin,
            },
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception('Login error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()
