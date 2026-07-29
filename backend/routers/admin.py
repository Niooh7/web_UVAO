import logging
import sqlite3
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from ..config import DATABASE_PATH
from ..utils.auth import hash_password, get_current_admin
from .schemas import AdminGenerateReportBody, CreateUserBody, UpdateUserBody

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get('/api/admin/verify')
def admin_verify(_: dict = Depends(get_current_admin)):
    return {'is_admin': True}


@router.post('/api/admin/generate-report')
def admin_generate_report(
    body: AdminGenerateReportBody,
    _: dict = Depends(get_current_admin),
):
    try:
        from ..parsers.ng import ng
        from ..parsers.mm import mm
        from ..parsers.mwi import mwi
        from ..parsers.mwis import mwis
        from ..parsers.tsafap import tsafap
        from ..parsers.oati import oati

        report_functions = {
            'our-city':        ng,
            'mayor-monitor':   mm,
            'prefect':         ng,
            'mzhi':            mwi,
            'mzhi-statistics': mwis,
            'tsafap':          tsafap,
            'oati':            oati,
        }

        if body.report_type not in report_functions:
            raise HTTPException(status_code=400, detail=f'Неизвестный тип отчёта: {body.report_type}')

        thread = threading.Thread(target=report_functions[body.report_type], daemon=True)
        thread.start()
        return {'status': 'started', 'message': 'Генерация отчёта запущена в фоне'}

    except HTTPException:
        raise
    except Exception:
        logger.exception('generate-report error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/admin/users')
def admin_get_users(_: dict = Depends(get_current_admin)):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.ID, u.Name, u.Login, o.Org_name, d.Duty_name, u.Last_visit
            FROM Users u
            LEFT JOIN Organizations o ON u.ID_organization = o.ID_organization
            LEFT JOIN Dutys d ON u.ID_duty = d.ID_duty
            ORDER BY u.ID
        """)
        users = [
            {
                'id':           r[0],
                'name':         r[1],
                'login':        r[2],
                'organization': r[3] or 'Не указана',
                'duty':         r[4] or 'Не указана',
                'last_visit':   r[5] or 'Никогда',
            }
            for r in cursor.fetchall()
        ]
        conn.close()
        return {'users': users}
    except Exception:
        logger.exception('admin_get_users error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.post('/api/admin/users', status_code=201)
def admin_create_user(body: CreateUserBody, _: dict = Depends(get_current_admin)):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT ID FROM Users WHERE Login = ?', (body.login,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail='Пользователь с таким логином уже существует')

        cursor.execute("""
            INSERT INTO Users (Name, Login, Password, ID_organization, ID_duty, Date_of_create)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            body.name, body.login, hash_password(body.password),
            body.id_organization, body.id_duty,
            datetime.now().strftime('%d.%m.%Y %H:%M'),
        ))
        conn.commit()
        return {'message': 'Пользователь создан', 'user_id': cursor.lastrowid}

    except HTTPException:
        raise
    except Exception:
        logger.exception('admin_create_user error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()


@router.put('/api/admin/users/{user_id}')
def admin_update_user(user_id: int, body: UpdateUserBody, _: dict = Depends(get_current_admin)):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT ID FROM Users WHERE ID = ?', (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Пользователь не найден')

        updates, values = [], []

        if body.name is not None:
            updates.append('Name = ?'); values.append(body.name)
        if body.login is not None:
            cursor.execute('SELECT ID FROM Users WHERE Login = ? AND ID != ?', (body.login, user_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail='Логин уже занят')
            updates.append('Login = ?'); values.append(body.login)
        if body.password:
            updates.append('Password = ?'); values.append(hash_password(body.password))
        if body.id_organization is not None:
            updates.append('ID_organization = ?'); values.append(body.id_organization)
        if body.id_duty is not None:
            updates.append('ID_duty = ?'); values.append(body.id_duty)

        if updates:
            values.append(user_id)
            cursor.execute(f"UPDATE Users SET {', '.join(updates)} WHERE ID = ?", values)
            conn.commit()

        return {'message': 'Пользователь обновлён'}

    except HTTPException:
        raise
    except Exception:
        logger.exception('admin_update_user error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()


@router.delete('/api/admin/users/{user_id}')
def admin_delete_user(user_id: int, _: dict = Depends(get_current_admin)):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT ID FROM Users WHERE ID = ?', (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Пользователь не найден')

        cursor.execute('DELETE FROM Users WHERE ID = ?', (user_id,))
        conn.commit()
        return {'message': 'Пользователь удалён'}

    except HTTPException:
        raise
    except Exception:
        logger.exception('admin_delete_user error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()


@router.get('/api/admin/organizations')
def admin_get_organizations(_: dict = Depends(get_current_admin)):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT ID_organization, Org_name FROM Organizations ORDER BY Org_name')
        orgs = [{'id': r[0], 'name': r[1]} for r in cursor.fetchall()]
        conn.close()
        return {'organizations': orgs}
    except Exception:
        logger.exception('admin_get_organizations error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/admin/dutys')
def admin_get_dutys(_: dict = Depends(get_current_admin)):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT ID_duty, Duty_name FROM Dutys ORDER BY Duty_name')
        dutys = [{'id': r[0], 'name': r[1]} for r in cursor.fetchall()]
        conn.close()
        return {'dutys': dutys}
    except Exception:
        logger.exception('admin_get_dutys error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/admin/activity')
def admin_get_activity(_: dict = Depends(get_current_admin)):
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.ID, u.Name, u.Login, u.Last_visit, o.Org_name, d.Duty_name
            FROM Users u
            LEFT JOIN Organizations o ON u.ID_organization = o.ID_organization
            LEFT JOIN Dutys d ON u.ID_duty = d.ID_duty
            WHERE u.Last_visit IS NOT NULL
            ORDER BY u.Last_visit DESC
        """)
        activities = [
            {
                'id':           r[0],
                'name':         r[1],
                'login':        r[2],
                'last_visit':   r[3],
                'organization': r[4] or 'Не указана',
                'duty':         r[5] or 'Не указана',
            }
            for r in cursor.fetchall()
        ]
        conn.close()
        return {'activities': activities}
    except Exception:
        logger.exception('admin_get_activity error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
