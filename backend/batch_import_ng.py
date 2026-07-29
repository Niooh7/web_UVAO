"""
Одноразовый скрипт для массовой загрузки исторических файлов НГ в БД.

Ищет все "Ответы в работе *.xlsx" в папке public/NG/, парсит дату из имени
файла, читает лист "Ответы в работе" и делает UPSERT в таблицу NG_prosrok.

Запуск (из папки backend/):
    python batch_import_ng.py

или с указанием другой папки:
    python batch_import_ng.py --folder "C:/path/to/NG"
"""

import argparse
import os
import re
import sqlite3
from datetime import datetime, timedelta, date

import pandas as pd

# ── Пути ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(SCRIPT_DIR, 'Databases', 'BD_work')
DEFAULT_NG_FOLDER = os.path.join(SCRIPT_DIR, 'public', 'NG')

# Нерабочие дни (из config.py) — нужны для расчёта «День»
EXCLUDED_DATES_STR = [
    "01.01.2026", "02.01.2026", "03.01.2026", "04.01.2026", "05.01.2026",
    "06.01.2026", "07.01.2026", "08.01.2026", "09.01.2026",
    "01.05.2026", "02.05.2026", "03.05.2026",
    "09.05.2026", "10.05.2026", "11.05.2026",
    "16.05.2026", "17.05.2026", "23.05.2026", "24.05.2026", "30.05.2026", "31.05.2026",
    "06.06.2026", "07.06.2026", "20.06.2026", "21.06.2026", "27.06.2026", "28.06.2026",
    "12.06.2026", "13.06.2026", "14.06.2026",
    "04.07.2026", "05.07.2026", "11.07.2026", "12.07.2026", "18.07.2026", "19.07.2026",
    "25.07.2026", "26.07.2026",
]
EXCLUDED_DATES = {
    datetime.strptime(d, "%d.%m.%Y").date() for d in EXCLUDED_DATES_STR
}


# ── Вспомогательные функции ───────────────────────────────────────────────────

def build_day_labels(base_date: date, excluded: set) -> dict:
    """Строит словарь {deadline_date: 'N день'} для 8 рабочих дней вперёд от base_date."""
    labels = {}
    current = base_date
    for n in range(1, 9):
        current += timedelta(days=1)
        while current in excluded:
            current += timedelta(days=1)
        labels[current] = f'{n} день'
    return labels


def deadline_to_day(deadline_dt, export_date: date, day_labels: dict) -> str:
    if deadline_dt is None or pd.isna(deadline_dt):
        return 'Просрок'
    dl = deadline_dt.date() if hasattr(deadline_dt, 'date') else deadline_dt
    if dl < export_date:
        return 'Просрок'
    return day_labels.get(dl, 'Просрок')


def parse_export_date(filename: str):
    """
    Разбирает дату из имени файла вида "Ответы в работе 15.01.2026 09-30.xlsx".
    Возвращает (datetime, str в формате '%Y-%m-%d %H:%M:%S') или None.
    """
    m = re.search(r'(\d{2}\.\d{2}\.\d{4})\s+(\d{2}-\d{2})', filename)
    if not m:
        return None, None
    dt = datetime.strptime(f"{m.group(1)} {m.group(2)}", "%d.%m.%Y %H-%M")
    return dt, dt.strftime('%Y-%m-%d %H:%M:%S')


def ensure_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS NG_prosrok (
            ID TEXT PRIMARY KEY,
            PublishDate TEXT,
            District TEXT,
            Deadline TEXT,
            PreparationStatus TEXT,
            Address TEXT,
            Problem TEXT,
            MonitorOverdue TEXT,
            Day TEXT,
            Status TEXT,
            FirstSeen TEXT,
            LastSeen TEXT,
            ExportDate TEXT
        )
    """)
    try:
        cur.execute("ALTER TABLE NG_prosrok ADD COLUMN ExportDate TEXT")
    except sqlite3.OperationalError:
        pass


def get_val(row, col_name, all_cols):
    if col_name not in all_cols:
        return None
    v = row.get(col_name)
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    return str(v).strip() or None


# ── Основная логика ───────────────────────────────────────────────────────────

def import_file(cur, filepath: str, export_dt: datetime, export_str: str):
    try:
        df = pd.read_excel(filepath, sheet_name='Ответы в работе')
    except Exception as e:
        print(f"  ! Не удалось прочитать лист 'Ответы в работе': {e}")
        return 0

    cols = df.columns.tolist()

    # Определяем имя колонки с номером сообщения
    id_col = 'Номер сообщения' if 'Номер сообщения' in cols else 'Номер заявки'

    export_date = export_dt.date()
    day_labels  = build_day_labels(export_date, EXCLUDED_DATES)

    rows_to_upsert = []
    current_ids    = []

    for _, row in df.iterrows():
        msg_id = get_val(row, id_col, cols)
        if not msg_id:
            continue
        current_ids.append(msg_id)

        deadline = row.get('Регламентный срок у сообщения (Портал)')
        try:
            deadline_dt = pd.to_datetime(deadline) if deadline and not pd.isna(deadline) else None
        except Exception:
            deadline_dt = None

        day_label    = deadline_to_day(deadline_dt, export_date, day_labels)
        deadline_str = str(deadline_dt) if deadline_dt is not None else None

        rows_to_upsert.append((
            msg_id,
            get_val(row, 'Дата публикации сообщения', cols),
            get_val(row, 'Район', cols),
            deadline_str,
            get_val(row, 'Статус подготовки ответа на сообщение', cols),
            get_val(row, 'Адрес', cols),
            get_val(row, 'Проблемная тема', cols),
            get_val(row, 'Просрок (Монитор)', cols),
            day_label,
            export_str,   # FirstSeen (будет проигнорировано ON CONFLICT)
            export_str,   # LastSeen
            export_str,   # ExportDate
        ))

    if rows_to_upsert:
        cur.executemany("""
            INSERT INTO NG_prosrok
                (ID, PublishDate, District, Deadline, PreparationStatus,
                 Address, Problem, MonitorOverdue, Day, Status,
                 FirstSeen, LastSeen, ExportDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'В работе', ?, ?, ?)
            ON CONFLICT(ID) DO UPDATE SET
                PublishDate=excluded.PublishDate,
                District=excluded.District,
                Deadline=excluded.Deadline,
                PreparationStatus=excluded.PreparationStatus,
                Address=excluded.Address,
                Problem=excluded.Problem,
                MonitorOverdue=excluded.MonitorOverdue,
                Day=excluded.Day,
                Status='В работе',
                LastSeen=excluded.LastSeen,
                ExportDate=excluded.ExportDate
        """, rows_to_upsert)

    # Помечаем как Устранено то, чего нет в этом файле
    if current_ids:
        placeholders = ','.join('?' * len(current_ids))
        cur.execute(
            f"UPDATE NG_prosrok SET Status='Устранено' "
            f"WHERE Status != 'Устранено' AND ID NOT IN ({placeholders})",
            current_ids,
        )
    else:
        cur.execute("UPDATE NG_prosrok SET Status='Устранено' WHERE Status != 'Устранено'")

    return len(rows_to_upsert)


def run(ng_folder: str):
    if not os.path.isdir(ng_folder):
        print(f"Папка не найдена: {ng_folder}")
        return

    xlsx_files = [
        f for f in os.listdir(ng_folder)
        if f.lower().endswith('.xlsx') and f.startswith('Ответы в работе')
    ]

    # Парсим даты и отфильтровываем файлы без даты в имени
    parsed = []
    for fname in xlsx_files:
        dt, dt_str = parse_export_date(fname)
        if dt:
            parsed.append((dt, dt_str, os.path.join(ng_folder, fname)))
        else:
            print(f"  ? Пропущен (не удалось разобрать дату): {fname}")

    if not parsed:
        print("Нет файлов для импорта.")
        return

    # Сортируем: от старых к новым
    parsed.sort(key=lambda x: x[0])

    print(f"Найдено файлов: {len(parsed)}")
    print(f"Период: {parsed[0][0].strftime('%d.%m.%Y')} → {parsed[-1][0].strftime('%d.%m.%Y')}")
    print()

    conn = sqlite3.connect(DATABASE_PATH)
    cur  = conn.cursor()
    ensure_table(cur)

    total_rows = 0
    for i, (export_dt, export_str, filepath) in enumerate(parsed, 1):
        fname = os.path.basename(filepath)
        print(f"[{i}/{len(parsed)}] {fname} ...", end=' ', flush=True)
        n = import_file(cur, filepath, export_dt, export_str)
        conn.commit()
        total_rows += n
        print(f"{n} строк")

    conn.close()
    print()
    print(f"Готово. Всего обработано строк: {total_rows}")
    print(f"База: {DATABASE_PATH}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Batch import NG Excel files into DB')
    parser.add_argument(
        '--folder', default=DEFAULT_NG_FOLDER,
        help=f'Путь к папке с файлами НГ (по умолчанию: {DEFAULT_NG_FOLDER})'
    )
    args = parser.parse_args()
    run(args.folder)
