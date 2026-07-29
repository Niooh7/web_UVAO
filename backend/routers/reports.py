import logging
import os
import re
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from werkzeug.utils import secure_filename

from ..config import BASE_DIR, _status_cache
from ..utils.status import _load_failure_state

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get('/api/report-status')
def get_report_status():
    if _status_cache['data'] is not None and time.time() - _status_cache['ts'] < 30:
        return _status_cache['data']
    _status_cache['data'] = _load_failure_state()
    _status_cache['ts'] = time.time()
    return _status_cache['data']


@router.get('/api/archive')
def get_archive(folder: Optional[str] = Query(None)):
    try:
        folder_name = folder
        if not folder_name:
            raise HTTPException(status_code=400, detail="Параметр folder обязателен")

        folder_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail=f"Папка {folder_name} не найдена")

        files = os.listdir(folder_path)

        def extract_datetime_from_filename(filename):
            match = re.search(r'(\d{2}\.\d{2}\.\d{4})\s+(\d{2}-\d{2})', filename)
            if match:
                date_str, time_str = match.groups()
                time_str = time_str.replace('-', ':')
                try:
                    return datetime.strptime(f"{date_str} {time_str}", '%d.%m.%Y %H:%M')
                except ValueError:
                    pass
            return None

        grouped_files = {}
        for file in files:
            file_datetime = extract_datetime_from_filename(file)
            if file_datetime:
                file_date_str = file_datetime.strftime('%d.%m.%Y')
                file_datetime_str = file_datetime.strftime('%d.%m.%Y %H:%M')

                if file_date_str not in grouped_files:
                    grouped_files[file_date_str] = []

                file_type = 'pdf' if file.endswith('.pdf') else 'xlsx' if file.endswith('.xlsx') else None
                if file_type:
                    grouped_files[file_date_str].append({
                        "name": file,
                        "type": file_type,
                        "datetime": file_datetime_str
                    })

        reports = [
            {"date": date, "files": sorted(files_data, key=lambda x: x['datetime'], reverse=True)}
            for date, files_data in grouped_files.items()
        ]

        reports.sort(key=lambda x: datetime.strptime(x["date"], '%d.%m.%Y'), reverse=True)

        return reports
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('reports error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/archive/download')
def download_file(
    folder: Optional[str] = Query(None),
    file: Optional[str] = Query(None),
):
    try:
        folder_name = folder
        file_name = file

        if not folder_name or not file_name:
            raise HTTPException(status_code=400, detail="Missing folder or file parameter")

        folder_path = os.path.join(BASE_DIR, folder_name)
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail=f"Папка {folder_name} не найдена")

        safe_file_name = secure_filename(file_name)
        file_path = os.path.join(folder_path, file_name)

        if os.path.exists(file_path):
            return FileResponse(file_path, filename=safe_file_name)
        else:
            raise HTTPException(status_code=404, detail="File not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('reports error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/api/files')
def get_files(folder_name: Optional[str] = Query(None)):
    try:
        if not folder_name:
            raise HTTPException(status_code=400, detail="Параметр folder_name обязателен")

        folder_path = os.path.join(BASE_DIR, folder_name)

        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail=f"Папка {folder_name} не найдена")

        files = os.listdir(folder_path)
        filtered_files = [f for f in files if f.endswith(('.xlsx', '.pdf'))]

        def extract_date_from_filename(filename):
            match = re.search(r'(\d{2}\.\d{2}\.\d{4})\s+(\d{2}-\d{2})', filename)
            if match:
                date_str, time_str = match.groups()
                time_str = time_str.replace('-', ':')
                try:
                    return datetime.strptime(f"{date_str} {time_str}", '%d.%m.%Y %H:%M')
                except ValueError:
                    pass
            return datetime.min

        sorted_files = sorted(filtered_files, key=extract_date_from_filename, reverse=True)

        return {
            "pdf": next((f for f in sorted_files if f.endswith('.pdf')), None),
            "xlsx": next((f for f in sorted_files if f.endswith('.xlsx')), None)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('reports error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')


@router.get('/reports/{folder_name}/{filename:path}')
def serve_report(folder_name: str, filename: str):
    try:
        folder_path = os.path.join(BASE_DIR, folder_name)
        print(f"📂 Запрос файла: {folder_path}/{filename}")

        if not os.path.exists(folder_path):
            print(f"❌ Папка не найдена: {folder_path}")
            raise HTTPException(status_code=404, detail="Folder not found")

        file_path = os.path.join(folder_path, filename)
        if not os.path.exists(file_path):
            print(f"❌ Файл не найден: {filename}")
            raise HTTPException(status_code=404, detail="File not found")

        print(f"✅ Отправляем файл: {filename} ({os.path.getsize(file_path)} байт)")
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Ошибка в serve_report: {e}")
        traceback.print_exc()
        logger.exception('reports error')
        raise HTTPException(status_code=500, detail='Внутренняя ошибка сервера')
