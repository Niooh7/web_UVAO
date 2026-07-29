import os
import subprocess
import time
import threading

import paramiko
import requests
import pythoncom

from ..config import REPORTS_CONFIG, REPORT_GROUP_ID, TOKEN, rest, FILE_UPLOAD_URL


def kill_excel_processes():
    """
    Принудительно закрывает ВСЕ процессы Excel.
    Используется после каждой обработки Excel для предотвращения зависаний.
    """
    try:
        result = subprocess.run(
            ['taskkill', '/F', '/IM', 'EXCEL.EXE'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print("✓ Все процессы Excel завершены")
        else:
            print("ℹ Процессы Excel не найдены (это нормально)")
    except subprocess.TimeoutExpired:
        print("⚠ Таймаут при закрытии Excel")
    except Exception as e:
        print(f"⚠ Ошибка при закрытии Excel: {e}")


def safe_excel_operation(func, *args, timeout_seconds=300, **kwargs):
    """
    Выполняет Excel операцию в отдельном потоке с жёстким таймаутом.
    Если Excel завис или показал диалог ошибки макроса — поток убивается
    через timeout_seconds, Excel принудительно закрывается, scheduler не блокируется.
    """
    print(f"[Excel] Запуск {func.__name__} (таймаут {timeout_seconds}с)")

    result_box = [None]
    error_box = [None]
    done = threading.Event()

    def _worker():
        # Каждый поток требует своей инициализации COM
        pythoncom.CoInitialize()
        try:
            result_box[0] = func(*args, **kwargs)
        except Exception as e:
            error_box[0] = e
        finally:
            pythoncom.CoUninitialize()
            done.set()

    kill_excel_processes()
    time.sleep(1)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

    finished = done.wait(timeout=timeout_seconds)

    if not finished:
        print(f"[Excel] ТАЙМАУТ {timeout_seconds}с — принудительное закрытие Excel")
        kill_excel_processes()
        raise TimeoutError(f"Excel operation '{func.__name__}' timed out after {timeout_seconds}s")

    kill_excel_processes()
    time.sleep(1)

    if error_box[0] is not None:
        raise error_box[0]

    print(f"[Excel] {func.__name__} завершена успешно")
    return result_box[0]


def send_file_to_telegram(file_path: str, caption: str = "Отчёт"):
    """Отправить файл в группу отчётов (упрощённая версия)"""
    url_upload = f"{FILE_UPLOAD_URL}/api/v1/upload/secret/encryptable"
    headers = {"Authorization": TOKEN}

    try:
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'application/octet-stream')}
            resp = requests.post(url_upload, headers=headers, files=files, timeout=120)

        if resp.status_code != 200:
            print(f"❌ Ошибка S3: {resp.status_code}")
            return False

        file_id = resp.json().get('resource', {}).get('id')

        url_send = f"{rest}/botapi/v1/messages/sendFile/-1/{REPORT_GROUP_ID}"
        payload = {
            "clientRandomId": int(time.time() * 1000),
            "file": {
                "fileName": os.path.basename(file_path),
                "length": 0,
                "mimeType": "application/octet-stream",
                "resourceRef": {
                    "id": file_id,
                    "key": "",
                    "transformation": "GOST3412-2015/ECB/PKCS7Padding",
                    "url": ""
                }
            },
            "message": caption
        }

        resp2 = requests.post(url_send, headers=headers, json=payload, timeout=60)

        if resp2.status_code == 200:
            print(f"✅ Файл отправлен: {file_path}")
            return True
        else:
            print(f"❌ Ошибка: {resp2.status_code}")
            return False

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False


def _cleanup_server_folder(folder_name: str, keep: int = 20):
    """Удаляет старые файлы из папки на сервере, оставляет последние `keep`."""
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            REPORTS_CONFIG['server_ip'],
            username=REPORTS_CONFIG['server_user'],
            key_filename=REPORTS_CONFIG['ssh_key'],
            timeout=30,
        )
        remote = f"{REPORTS_CONFIG['remote_reports_path']}/{folder_name}"
        cmd = (
            f"ls -t {remote}/ 2>/dev/null"
            f" | tail -n +{keep + 1}"
            f" | xargs -I{{}} rm -f {remote}/{{}}"
        )
        _, stdout, _ = ssh.exec_command(cmd)
        stdout.channel.recv_exit_status()
        ssh.close()
        print(f"[Cleanup] Сервер {folder_name}: ротация выполнена")
    except Exception as e:
        print(f"[Cleanup] Ошибка очистки сервера {folder_name}: {e}")


def keep_latest_files(local_dir: str, folder_key: str, keep: int = 20):
    """Ротирует папку на сервере, оставляя последние `keep` файлов."""
    _cleanup_server_folder(folder_key, keep)


def clean_parcing_folder():
    """Очищает ~/Desktop/parcing/ после успешной обработки."""
    parcing_dir = os.path.join(os.path.expanduser("~"), "Desktop", "parcing")
    if not os.path.exists(parcing_dir):
        return
    for fname in os.listdir(parcing_dir):
        fpath = os.path.join(parcing_dir, fname)
        try:
            if os.path.isfile(fpath):
                os.remove(fpath)
        except Exception as e:
            print(f"[Cleanup] Не удалось удалить {fpath}: {e}")
    print("[Cleanup] Папка parcing очищена")


def upload_reports_to_server(folder_name, local_files, max_retries=3, retry_delay=2):
    """
    Загружает файлы отчётов на сервер через scp.

    :param folder_name: Название папки (MM, NG, MWI, MWIS, TSAFAP)
    :param local_files: Список путей к локальным файлам для загрузки
    :param max_retries: Максимальное количество попыток
    :param retry_delay: Задержка между попытками в секундах
    :return: True если успешно, False иначе
    """
    retries = 0
    success = False

    while retries < max_retries and not success:
        try:
            retries += 1
            print(f"Попытка загрузки отчётов {retries} из {max_retries}")

            # Проверка существования файлов
            for file_path in local_files:
                if not os.path.exists(file_path):
                    print(f"Ошибка: Файл {file_path} не существует.")
                    continue

            # Формирование команды scp для каждого файла
            for file_path in local_files:
                command = [
                    "scp",
                    "-i", REPORTS_CONFIG['ssh_key'],
                    file_path,
                    f"{REPORTS_CONFIG['server_user']}@{REPORTS_CONFIG['server_ip']}:{REPORTS_CONFIG['remote_reports_path']}/{folder_name}/"
                ]
                print(f"Загружаем {os.path.basename(file_path)}...")

                result = subprocess.run(
                    command,
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                print(f"✅ {os.path.basename(file_path)} загружен на сервер")

            success = True
            print(f"✔ Все отчёты загружены в /var/www/reports/{folder_name}/")
            return True

        except subprocess.TimeoutExpired:
            print(f"Таймаут при загрузке. Повтор через {retry_delay} сек...")
            time.sleep(retry_delay)
        except subprocess.CalledProcessError as e:
            print(f"Ошибка scp: {e.stderr}")
            time.sleep(retry_delay)
        except Exception as e:
            print(f"Ошибка: {e}")
            time.sleep(retry_delay)

    print("❌ Не удалось загрузить отчёты на сервер")
    return False


def _get_chromedriver() -> str:
    """Re-export from status module for convenience."""
    from ..utils.status import _get_chromedriver as _gc
    return _gc()
