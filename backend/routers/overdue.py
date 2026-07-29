import logging
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..config import DATABASE_PATH
from ..utils.auth import get_current_user, get_current_admin
from .schemas import UpdateLastVisitBody

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post('/api/update-last-visit')
def update_last_visit(
    body: UpdateLastVisitBody,
    _: dict = Depends(get_current_user),
):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")
        cursor = conn.cursor()

        cursor.execute('SELECT ID FROM Users WHERE ID = ?', (body.userId,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Пользователь не найден')

        cursor.execute('UPDATE Users SET Last_visit = ? WHERE ID = ?', (body.lastVisit, body.userId))
        conn.commit()
        return {'status': 'success'}

    except HTTPException:
        raise
    except Exception:
        logger.exception('update_last_visit error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()


@router.delete('/api/overdue/{request_id}')
def delete_overdue(
    request_id: str,
    _: dict = Depends(get_current_admin),
):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")
        cursor = conn.cursor()

        cursor.execute('SELECT ID FROM MM_prosrok WHERE ID = ?', (request_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Запись не найдена')

        cursor.execute('DELETE FROM MM_prosrok WHERE ID = ?', (request_id,))
        conn.commit()
        return {'message': 'Запись удалена'}

    except HTTPException:
        raise
    except Exception:
        logger.exception('delete_overdue error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()
