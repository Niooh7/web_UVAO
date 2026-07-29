import logging
import os
import re
import sqlite3
from datetime import datetime
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..config import DATABASE_PATH, DB_DELAYS_PATH, directory

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get('/api/bot-transfers')
def get_bot_transfers(
    district: Optional[List[str]] = Query(None),
    portal_search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    try:
        conn = sqlite3.connect(DB_DELAYS_PATH, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")
        cur = conn.cursor()

        where_clauses: list = []
        params: list = []

        if district:
            placeholders = ','.join(['?'] * len(district))
            where_clauses.append(f"district IN ({placeholders})")
            params.extend(district)
        if portal_search and portal_search.strip():
            where_clauses.append("portal_number LIKE ?")
            params.append(f"%{portal_search.strip()}%")

        where = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        cur.execute(f"""
            SELECT
                COUNT(*),
                SUM(CASE WHEN status = 'Одобрена' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status = 'Отклонена' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status NOT IN ('Одобрена', 'Отклонена') THEN 1 ELSE 0 END)
            FROM requests {where}
        """, params)
        row = cur.fetchone()
        total = row[0] or 0
        total_approved = row[1] or 0
        total_rejected = row[2] or 0
        total_pending = row[3] or 0

        offset = (page - 1) * page_size
        cur.execute(f"""
            SELECT id, status, created_at, district, level, portal_number,
                   transfer_type, desired_date, reject_reason
            FROM requests {where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, params + [page_size, offset])

        rows = cur.fetchall()
        conn.close()

        data = [
            {
                "id": r[0], "status": r[1], "created_at": r[2],
                "district": r[3], "level": r[4], "portal_number": r[5],
                "transfer_type": r[6], "desired_date": r[7], "reject_reason": r[8],
            }
            for r in rows
        ]

        return {
            "data": data,
            "total": total,
            "total_approved": int(total_approved),
            "total_rejected": int(total_rejected),
            "total_pending": int(total_pending),
            "page": page,
            "page_size": page_size,
        }

    except Exception as e:
        print(f"Error in get_bot_transfers: {e}")
        logger.exception('bot transfers error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/transfer-statistics')
def get_transfer_statistics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    try:
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Параметры start_date и end_date обязательны")

        print(f"DEBUG: Получен запрос на статистику с {start_date} по {end_date}")

        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')

        print("=== ПОЛУЧЕНИЕ ПЕРЕНОСОВ ЧЕРЕЗ БОТА ===")
        conn_bot = sqlite3.connect(DB_DELAYS_PATH)
        cursor_bot = conn_bot.cursor()

        cursor_bot.execute("""
            SELECT portal_number, district, transfer_type, desired_date, created_at
            FROM requests
            WHERE status = 'Одобрено окончательно (модератор 1)'
            AND created_at >= ?
            AND created_at <= ?
            AND desired_date IS NOT NULL
            AND desired_date != ''
            ORDER BY created_at DESC
        """, (
            f"{start_date} 00:00:00",
            f"{end_date} 23:59:59"
        ))

        bot_all_data = cursor_bot.fetchall()
        print(f"DEBUG: Найдено {len(bot_all_data)} записей через бота")
        conn_bot.close()

        print("=== ПОЛУЧЕНИЕ ПЕРЕНОСОВ ЧЕРЕЗ НГ ===")
        conn_ng = sqlite3.connect(DATABASE_PATH, timeout=30)
        cursor_ng = conn_ng.cursor()

        start_date_ng = start_dt.strftime('%d.%m.%Y')
        end_date_ng = end_dt.strftime('%d.%m.%Y')

        cursor_ng.execute("""
            SELECT ID, District, Type, Date_answer
            FROM delays_ng
            WHERE Date_answer IS NOT NULL
            AND Date_answer != ''
            AND (
                (Date_answer LIKE ? || '%' OR Date_answer >= ?) OR
                (Date_answer LIKE ? || '%')
            )
            ORDER BY Date_answer DESC
        """, (
            start_date_ng, start_date_ng,
            start_date
        ))

        ng_all_data = cursor_ng.fetchall()
        print(f"DEBUG: Найдено {len(ng_all_data)} записей через НГ")
        conn_ng.close()

        def normalize_district(district):
            if not district:
                return "Не указан"

            district = str(district).strip()

            district_mapping = {
                'АВД ЮВАО': 'АВД ЮВАО',
                'АВД': 'АВД ЮВАО',
                'Выхино-Жулебино': 'Выхино-Жулебино',
                'Выхино': 'Выхино-Жулебино',
                'Капотня': 'Капотня',
                'Кузьминки': 'Кузьминки',
                'Лефортово': 'Лефортово',
                'Люблино': 'Люблино',
                'Марьино': 'Марьино',
                'Некрасовка': 'Некрасовка',
                'Нижегородский': 'Нижегородский',
                'Нижегородский район': 'Нижегородский',
                'Печатники': 'Печатники',
                'Рязанский': 'Рязанский',
                'Рязанский район': 'Рязанский',
                'Текстильщики': 'Текстильщики',
                'Южнопортовый': 'Южнопортовый',
                'Южнопортовый район': 'Южнопортовый'
            }

            return district_mapping.get(district, district)

        def parse_response_date(date_str):
            if not date_str:
                return None
            try:
                date_str = str(date_str).strip()

                if '.' in date_str:
                    date_part = date_str.split(' ')[0]
                    if re.match(r'\d{2}\.\d{2}\.\d{4}', date_part):
                        return datetime.strptime(date_part, '%d.%m.%Y')

                elif '-' in date_str and date_str.count('-') == 2:
                    date_part = date_str.split(' ')[0]
                    return datetime.strptime(date_part, '%Y-%m-%d')

                return None
            except Exception as e:
                print(f"Ошибка парсинга даты ответа '{date_str}': {e}")
                return None

        bot_transfers = {}
        bot_detailed_data = []

        for row in bot_all_data:
            portal_number, district, transfer_type, desired_date, created_at = row

            normalized_district = normalize_district(district)
            response_date_dt = parse_response_date(desired_date)
            response_date_str = response_date_dt.strftime('%Y-%m-%d') if response_date_dt else "Не указана"
            created_dt = datetime.strptime(created_at, '%Y-%m-%d %H:%M:%S')

            bot_transfers[normalized_district] = bot_transfers.get(normalized_district, 0) + 1

            bot_detailed_data.append({
                "id": portal_number,
                "district": normalized_district,
                "type": transfer_type,
                "dateAnswer": response_date_str,
                "dateCreated": created_dt.strftime('%Y-%m-%d %H:%M:%S'),
                "transferType": "bot"
            })

        print(f"DEBUG: Переносы через бота по районам: {bot_transfers}")

        ng_transfers = {}
        ng_detailed_data = []

        for row in ng_all_data:
            portal_id, district, transfer_type, date_str = row

            normalized_district = normalize_district(district)
            date_dt = parse_response_date(date_str)

            if date_dt and start_dt <= date_dt <= end_dt:
                ng_transfers[normalized_district] = ng_transfers.get(normalized_district, 0) + 1

                ng_detailed_data.append({
                    "id": portal_id,
                    "district": normalized_district,
                    "type": transfer_type,
                    "dateAnswer": date_dt.strftime('%Y-%m-%d'),
                    "dateCreated": date_dt.strftime('%Y-%m-%d'),
                    "transferType": "ng"
                })

        print(f"DEBUG: Переносы через НГ по районам: {ng_transfers}")

        all_districts = [
            'АВД ЮВАО', 'Выхино-Жулебино', 'Капотня', 'Кузьминки', 'Лефортово',
            'Люблино', 'Марьино', 'Некрасовка', 'Нижегородский', 'Печатники',
            'Рязанский', 'Текстильщики', 'Южнопортовый'
        ]

        summary_data = []
        total_bot = 0
        total_ng = 0

        for district in all_districts:
            bot_count = bot_transfers.get(district, 0)
            ng_count = ng_transfers.get(district, 0)

            total_bot += bot_count
            total_ng += ng_count

            if ng_count > 0:
                transfer_percentage = round((bot_count / ng_count) * 100, 2)
            else:
                transfer_percentage = 100 if bot_count > 0 else 0

            summary_data.append({
                "district": district,
                "botTransfers": bot_count,
                "ngTransfers": ng_count,
                "transferPercentage": transfer_percentage,
                "totalTransfers": bot_count + ng_count
            })

        summary_data.sort(key=lambda x: x['transferPercentage'], reverse=True)

        detailed_data = bot_detailed_data + ng_detailed_data
        detailed_data.sort(key=lambda x: str(x.get('dateCreated', '')), reverse=True)

        period_str = f"{start_date} - {end_date}" if start_date and end_date else "Период не указан"

        response_data = {
            "summary": summary_data,
            "rawData": detailed_data,
            "metadata": {
                "period": period_str,
                "totalBotTransfers": int(total_bot),
                "totalNgTransfers": int(total_ng),
                "totalAllTransfers": int(total_bot + total_ng),
                "botPercentage": float(round((total_bot / (total_bot + total_ng) * 100), 2)) if (
                                                                                                        total_bot + total_ng) > 0 else 0.0,
                "filterInfo": {
                    "bot": "Фильтрация по created_at",
                    "ng": "Фильтрация по Date_answer"
                },
                "dataSources": {
                    "bot": "requests.db",
                    "ng": "delays_ng"
                }
            }
        }

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_transfer_statistics: {e}")
        import traceback
        traceback.print_exc()
        logger.exception('statistics error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/transfer-statistics/export')
def export_transfer_statistics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    type: Optional[str] = Query('summary'),
):
    try:
        export_type = type

        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Параметры start_date и end_date обязательны")

        if export_type == 'summary':
            conn_bot = sqlite3.connect(DB_DELAYS_PATH)
            cursor_bot = conn_bot.cursor()

            cursor_bot.execute("""
                SELECT district, COUNT(*) as count
                FROM requests
                WHERE status = 'Одобрено окончательно (модератор 1)'
                AND created_at >= ?
                AND created_at <= ?
                AND desired_date IS NOT NULL
                AND desired_date != ''
                GROUP BY district
            """, (
                f"{start_date} 00:00:00",
                f"{end_date} 23:59:59"
            ))

            bot_results = cursor_bot.fetchall()
            bot_transfers = {row[0]: row[1] for row in bot_results}
            conn_bot.close()

            conn_ng = sqlite3.connect(DATABASE_PATH, timeout=30)
            cursor_ng = conn_ng.cursor()

            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            start_date_ng = start_dt.strftime('%d.%m.%Y')

            cursor_ng.execute("""
                SELECT District, COUNT(*) as count
                FROM delays_ng
                WHERE Date_answer IS NOT NULL
                AND Date_answer != ''
                AND (Date_answer LIKE ? || '%' OR Date_answer >= ?)
                GROUP BY District
            """, (start_date_ng, start_date_ng))

            ng_results = cursor_ng.fetchall()
            ng_transfers = {row[0]: row[1] for row in ng_results}
            conn_ng.close()

            all_districts = [
                'АВД ЮВАО', 'Выхино-Жулебино', 'Капотня', 'Кузьминки', 'Лефортово',
                'Люблино', 'Марьино', 'Некрасовка', 'Нижегородский', 'Печатники',
                'Рязанский', 'Текстильщики', 'Южнопортовый'
            ]

            export_data = []
            total_bot = 0
            total_ng = 0

            for district in all_districts:
                bot_count = bot_transfers.get(district, 0)
                ng_count = ng_transfers.get(district, 0)
                total = bot_count + ng_count

                total_bot += bot_count
                total_ng += ng_count

                percentage = round((bot_count / total * 100), 2) if total > 0 else 0

                export_data.append({
                    'Район': district,
                    'Через бота': bot_count,
                    'Через НГ': ng_count,
                    'Всего': total,
                    '% через бота': f"{percentage}%"
                })

            total_percentage = round((total_bot / (total_bot + total_ng) * 100), 2) if (total_bot + total_ng) > 0 else 0
            export_data.append({
                'Район': 'ИТОГО',
                'Через бота': total_bot,
                'Через НГ': total_ng,
                'Всего': total_bot + total_ng,
                '% через бота': f"{total_percentage}%"
            })

            df = pd.DataFrame(export_data)

        elif export_type == 'bot':
            conn_bot = sqlite3.connect(DB_DELAYS_PATH)
            cursor_bot = conn_bot.cursor()

            cursor_bot.execute("""
                SELECT portal_number, district, transfer_type, desired_date, created_at
                FROM requests
                WHERE status = 'Одобрено окончательно (модератор 1)'
                AND created_at >= ?
                AND created_at <= ?
                AND desired_date IS NOT NULL
                AND desired_date != ''
                ORDER BY created_at DESC
            """, (
                f"{start_date} 00:00:00",
                f"{end_date} 23:59:59"
            ))

            data = cursor_bot.fetchall()
            conn_bot.close()

            df = pd.DataFrame(data, columns=['ID заявки', 'Район', 'Тип переноса', 'Дата переноса', 'Дата создания'])

        elif export_type == 'ng':
            conn_ng = sqlite3.connect(DATABASE_PATH, timeout=30)
            cursor_ng = conn_ng.cursor()

            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            start_date_ng = start_dt.strftime('%d.%m.%Y')

            cursor_ng.execute("""
                SELECT ID, District, Type, Date_answer
                FROM delays_ng
                WHERE Date_answer IS NOT NULL
                AND Date_answer != ''
                AND (Date_answer LIKE ? || '%' OR Date_answer >= ?)
                ORDER BY Date_answer DESC
            """, (start_date_ng, start_date_ng))

            data = cursor_ng.fetchall()
            conn_ng.close()

            df = pd.DataFrame(data, columns=['ID заявки', 'Район', 'Тип переноса', 'Дата переноса'])

        elif export_type == 'all':
            conn_bot = sqlite3.connect(DB_DELAYS_PATH)
            cursor_bot = conn_bot.cursor()

            cursor_bot.execute("""
                SELECT portal_number, district, transfer_type, desired_date, created_at
                FROM requests
                WHERE status = 'Одобрено окончательно (модератор 1)'
                AND created_at >= ?
                AND created_at <= ?
                AND desired_date IS NOT NULL
                AND desired_date != ''
                ORDER BY created_at DESC
            """, (
                f"{start_date} 00:00:00",
                f"{end_date} 23:59:59"
            ))

            bot_data = cursor_bot.fetchall()
            conn_bot.close()

            conn_ng = sqlite3.connect(DATABASE_PATH, timeout=30)
            cursor_ng = conn_ng.cursor()

            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            start_date_ng = start_dt.strftime('%d.%m.%Y')

            cursor_ng.execute("""
                SELECT ID, District, Type, Date_answer
                FROM delays_ng
                WHERE Date_answer IS NOT NULL
                AND Date_answer != ''
                AND (Date_answer LIKE ? || '%' OR Date_answer >= ?)
                ORDER BY Date_answer DESC
            """, (start_date_ng, start_date_ng))

            ng_data = cursor_ng.fetchall()
            conn_ng.close()

            all_data = []
            for row in bot_data:
                all_data.append((row[0], row[1], row[2], row[3], 'Бот', row[4]))
            for row in ng_data:
                all_data.append((row[0], row[1], row[2], row[3], 'НГ', row[3]))

            all_data.sort(key=lambda x: x[5], reverse=True)

            df = pd.DataFrame(all_data, columns=['ID заявки', 'Район', 'Тип переноса', 'Дата переноса', 'Источник',
                                                 'Дата создания'])
        else:
            raise HTTPException(status_code=400, detail=f"Неизвестный тип экспорта: {export_type}")

        filename = f"переносы_{export_type}_{start_date}_{end_date}.xlsx"
        temp_file = os.path.join(directory, filename)

        with pd.ExcelWriter(temp_file, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Данные', index=False)

            worksheet = writer.sheets['Данные']
            for idx, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).str.len().max(), len(col)) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 30)

        return FileResponse(
            temp_file,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in export_transfer_statistics: {e}")
        import traceback
        traceback.print_exc()
        logger.exception('statistics error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/chart_data')
def get_chart_data(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    problem_topic: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
):
    try:
        conn = sqlite3.connect(DATABASE_PATH, timeout=30)
        cursor = conn.cursor()

        query = """
        SELECT
            ID,
            DATE(Deadline) as date,
            District as region_id,
            Problem as theme,
            Resource,
            Status,
            Address,
            ControlObject,
            IsOverdue
        FROM MM_prosrok
        WHERE 1=1
        """

        params = []

        if overdue_only:
            query += " AND IsOverdue = 'Да'"

        if start_date:
            query += " AND DATE(Deadline) >= ?"
            params.append(start_date)

        if end_date:
            query += " AND DATE(Deadline) <= ?"
            params.append(end_date)

        if problem_topic:
            query += " AND Problem = ?"
            params.append(problem_topic)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        data_by_date = {}
        for row in rows:
            date_str = row[1]
            issue_data = {
                "ID": row[0],
                "date": date_str,
                "region_id": row[2],
                "theme": row[3],
                "Resource": row[4],
                "status": row[5],
                "address": row[6],
                "controlObject": row[7],
                "isOverdue": row[8],
            }

            if date_str not in data_by_date:
                data_by_date[date_str] = {"date": date_str, "issues": []}

            data_by_date[date_str]["issues"].append(issue_data)

        result_data = sorted(
            list(data_by_date.values()),
            key=lambda x: x['date'],
            reverse=True
        )

        return result_data

    except Exception as e:
        print(f"Error in get_chart_data: {e}")
        logger.exception('statistics error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/chart_filters')
def get_chart_filters():
    try:
        conn = sqlite3.connect(DATABASE_PATH, timeout=30)
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT Problem FROM MM_prosrok WHERE Problem IS NOT NULL ORDER BY Problem")
        problems = [row[0] for row in cursor.fetchall()]

        conn.close()

        return {"problems": problems}

    except Exception as e:
        print(f"Error in get_chart_filters: {e}")
        logger.exception('statistics error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/date_range')
def get_date_range():
    try:
        conn = sqlite3.connect(DATABASE_PATH, timeout=30)
        cursor = conn.cursor()

        cursor.execute("SELECT MIN(DATE(Deadline)), MAX(DATE(Deadline)) FROM MM_prosrok")
        min_date, max_date = cursor.fetchone()

        conn.close()

        return {"min_date": min_date, "max_date": max_date}

    except Exception as e:
        print(f"Error in get_date_range: {e}")
        logger.exception('statistics error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
