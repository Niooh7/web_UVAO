import logging
import sqlite3
from datetime import datetime
from io import BytesIO
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..config import DATABASE_PATH

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get('/api/ng_overdue')
def get_ng_overdue():
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ID, PublishDate, District, Deadline, PreparationStatus,
                   Address, Problem, MonitorOverdue, Day, Status, ExportDate
            FROM NG_prosrok
            ORDER BY Deadline ASC
        """)
        rows = cursor.fetchall()

        return [
            {
                'id': row[0],
                'publishDate': row[1],
                'district': row[2],
                'deadline': row[3],
                'preparationStatus': row[4],
                'address': row[5],
                'problem': row[6],
                'monitorOverdue': row[7] or 'Нет признака',
                'day': row[8],
                'status': row[9],
                'exportDate': row[10],
            }
            for row in rows
        ]

    except sqlite3.OperationalError:
        return []
    except Exception:
        logger.exception('get_ng_overdue error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()


@router.get('/api/ng_overdue/export')
def export_ng_overdue(
    export_date_from: Optional[str] = Query(None),
    export_date_to: Optional[str] = Query(None),
    districts: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    urgent_only: Optional[str] = Query(None),
):
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        conditions = []
        params = []

        if export_date_from:
            conditions.append("ExportDate >= ?")
            params.append(export_date_from + ' 00:00:00')
        if export_date_to:
            conditions.append("ExportDate <= ?")
            params.append(export_date_to + ' 23:59:59')
        if districts:
            district_list = [d.strip() for d in districts.split(',') if d.strip()]
            if district_list:
                placeholders = ','.join('?' * len(district_list))
                conditions.append(f"District IN ({placeholders})")
                params.extend(district_list)
        if search:
            conditions.append("ID LIKE ?")
            params.append(f'%{search}%')
        if urgent_only == '1':
            conditions.append("Day IN ('Просрок', '6 день', '7 день', '8 день')")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cursor.execute(f"""
            SELECT ID, Day, Status, PublishDate, ExportDate, District,
                   Deadline, PreparationStatus, Address, Problem, MonitorOverdue
            FROM NG_prosrok
            {where}
            ORDER BY Deadline ASC
        """, params)
        rows = cursor.fetchall()

        df = pd.DataFrame(rows, columns=[
            'Номер сообщения', 'День', 'Статус', 'Дата публикации', 'Дата выгрузки',
            'Район', 'Регл. срок (Портал)', 'Статус ответа', 'Адрес',
            'Проблемная тема', 'Просрок (Монитор)',
        ])

        buf = BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Дашборд НГ', index=False)
            ws = writer.sheets['Дашборд НГ']
            col_widths = [22, 10, 12, 18, 18, 18, 22, 30, 35, 35, 20]
            for i, w in enumerate(col_widths, start=1):
                ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w
        buf.seek(0)

        filename = f"ng_overdue_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        return StreamingResponse(
            buf,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )

    except sqlite3.OperationalError:
        raise HTTPException(status_code=404, detail='Данные ещё не загружены')
    except Exception:
        logger.exception('export_ng_overdue error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
    finally:
        if conn:
            conn.close()
