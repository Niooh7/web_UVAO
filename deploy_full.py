#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для полной сборки React-проекта и деплоя на сервер.

Использование:
    python deploy_full.py

Требования:
    - Node.js и npm установлены
    - SSH-ключ настроен
    - Доступ к серверу есть
"""

import os
import sys
import subprocess
import paramiko
import time
from datetime import datetime


# ============================================================================
# КОНФИГУРАЦИЯ
# ============================================================================

# Путь к корневой папке проекта (где находится этот скрипт)
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# Конфигурация сервера
SERVER_CONFIG = {
    'server_ip': "5.129.206.66",
    'server_user': "root",
    'ssh_key': os.path.join(os.path.expanduser("~"), '.ssh', 'id_ed25519'),
    'remote_path': "/var/www",
}

# Пути к локальным папкам
FRONTEND_PATH = os.path.join(PROJECT_ROOT, 'frontend')
LOCAL_DIST_PATH = os.path.join(FRONTEND_PATH, 'dist')

# Путь к npm (для Windows)
NPM_PATH = "C:/Program Files/nodejs/npm.cmd"


# ============================================================================
# ФУНКЦИИ
# ============================================================================

def log(message, level="INFO"):
    """Вывод логов с временной меткой"""
    timestamp = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def check_prerequisites():
    """Проверка необходимых компонентов"""
    log("Проверка необходимых компонентов...")
    
    # Проверка наличия package.json
    package_json_path = os.path.join(FRONTEND_PATH, 'package.json')
    if not os.path.exists(package_json_path):
        log(f"❌ Файл package.json не найден: {package_json_path}", "ERROR")
        return False
    log("✓ package.json найден", "OK")
    
    # Проверка наличия npm
    try:
        result = subprocess.run(
            [NPM_PATH, '--version'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            log(f"✓ npm версии {result.stdout.strip()} найден", "OK")
        else:
            log("❌ npm не найден или не работает", "ERROR")
            return False
    except FileNotFoundError:
        log(f"❌ npm не найден по пути: {NPM_PATH}", "ERROR")
        return False
    except subprocess.TimeoutExpired:
        log("❌ Таймаут при проверке npm", "ERROR")
        return False
    
    # Проверка SSH-ключа
    if not os.path.exists(SERVER_CONFIG['ssh_key']):
        log(f"❌ SSH-ключ не найден: {SERVER_CONFIG['ssh_key']}", "ERROR")
        return False
    log("✓ SSH-ключ найден", "OK")
    
    return True


def build_react_project():
    """
    Сборка React-проекта с помощью npm run build.
    
    :return: True если успешно, False иначе
    """
    log("Начало сборки React-проекта...")
    
    try:
        # Переход в директорию frontend
        log(f"Рабочая директория: {FRONTEND_PATH}")
        os.chdir(FRONTEND_PATH)

        # Проверка наличия package.json
        if not os.path.exists("package.json"):
            log("❌ Файл package.json не найден в директории проекта", "ERROR")
            return False
        
        # Проверка наличия скрипта build в package.json
        import json
        with open("package.json", "r", encoding='utf-8') as f:
            package_json = json.load(f)
        
        if "scripts" not in package_json or "build" not in package_json["scripts"]:
            log("❌ Скрипт 'build' не найден в package.json", "ERROR")
            return False
        
        # Сборка проекта
        log("Выполнение: npm run build")
        result_build = subprocess.run(
            [NPM_PATH, "run", "build"],
            check=True,
            capture_output=True,
            text=True,
            timeout=600  # 10 минут на сборку
        )
        
        if result_build.stdout:
            print(result_build.stdout)
        
        log("✓ Проект успешно собран", "OK")
        
        # Проверка наличия папки dist
        if not os.path.exists(LOCAL_DIST_PATH):
            log("❌ Папка dist не создана после сборки", "ERROR")
            return False
        
        # ⭐ ОЧИСТКА: Удаляем папки отчётов из dist/ (они из public/)
        log("🗑️ Очистка dist/ от папок с отчётами (MM, NG, MWI, MWIS, Pref)...")
        report_folders = ['MM', 'NG', 'MWI', 'MWIS', 'Pref']
        for folder in report_folders:
            folder_path = os.path.join(LOCAL_DIST_PATH, folder)
            if os.path.exists(folder_path):
                import shutil
                shutil.rmtree(folder_path)
                log(f"  ✓ Удалена папка: {folder}", "OK")
        
        # Подсчёт файлов в dist
        file_count = sum([len(files) for _, _, files in os.walk(LOCAL_DIST_PATH)])
        log(f"✓ В папке dist создано файлов: {file_count}", "OK")
        
        return True
        
    except subprocess.TimeoutExpired:
        log("❌ Таймаут при сборке проекта (10 минут)", "ERROR")
        return False
    except subprocess.CalledProcessError as e:
        log(f"❌ Ошибка при сборке проекта (код {e.returncode})", "ERROR")
        if e.stderr:
            log(f"stderr: {e.stderr}", "ERROR")
        return False
    except Exception as e:
        log(f"❌ Неожиданная ошибка: {e}", "ERROR")
        return False
    finally:
        # Возврат в корневую директорию проекта
        os.chdir(PROJECT_ROOT)


def upload_dist_to_server(max_retries=3, retry_delay=5):
    """
    Перенос папки dist на сервер с помощью scp.
    ВАЖНО: Папка public/ с отчётами НЕ загружается (только dist/).
    Отчёты из dist/ (если попали) удаляются перед загрузкой.
    
    :param max_retries: Максимальное количество попыток
    :param retry_delay: Задержка между попытками в секундах
    :return: True если успешно, False иначе
    """
    log(f"Начало загрузки dist на сервер ({max_retries} попыток)...")
    log("⚠ Папка public/ с отчётами НЕ загружается (остаётся только на локальной машине)")
    
    # ⭐ ПРОВЕРКА: Удаляем отчёты из dist/ если они там есть
    report_folders = ['MM', 'NG', 'MWI', 'MWIS', 'Pref']
    for folder in report_folders:
        folder_path = os.path.join(LOCAL_DIST_PATH, folder)
        if os.path.exists(folder_path):
            import shutil
            shutil.rmtree(folder_path)
            log(f"⚠ Удалена папка отчётов из dist/: {folder}", "WARNING")
    
    retries = 0
    success = False
    
    while retries < max_retries and not success:
        try:
            retries += 1
            log(f"Попытка {retries} из {max_retries}", "RETRY")
            
            # Проверка существования локальной папки
            if not os.path.exists(LOCAL_DIST_PATH):
                log(f"❌ Локальная папка не существует: {LOCAL_DIST_PATH}", "ERROR")
                return False
            
            # Очистка папки /var/www/dist на сервере
            log("Очистка папки /var/www/dist на сервере...")
            clear_command = [
                "ssh",
                "-i", SERVER_CONFIG['ssh_key'],
                "-o", "StrictHostKeyChecking=no",
                f"{SERVER_CONFIG['server_user']}@{SERVER_CONFIG['server_ip']}",
                "rm -rf /var/www/dist/*"
            ]
            result = subprocess.run(
                clear_command,
                check=True,
                capture_output=True,
                text=True,
                timeout=60
            )
            log("✓ Папка /var/www/dist успешно очищена", "OK")
            
            # Отправка новой папки dist на сервер
            log(f"Загрузка dist на сервер: {LOCAL_DIST_PATH} → {SERVER_CONFIG['server_ip']}:{SERVER_CONFIG['remote_path']}/")
            command = [
                "scp",
                "-i", SERVER_CONFIG['ssh_key'],
                "-o", "StrictHostKeyChecking=no",
                "-r",
                LOCAL_DIST_PATH,
                f"{SERVER_CONFIG['server_user']}@{SERVER_CONFIG['server_ip']}:{SERVER_CONFIG['remote_path']}/"
            ]
            
            result = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=600  # 10 минут на загрузку
            )
            
            log("✓ Папка dist успешно загружена на сервер", "OK")
            
            # Настройка прав доступа и перезапуск nginx
            log("Настройка прав доступа и перезапуск nginx...")
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            try:
                ssh.connect(
                    hostname=SERVER_CONFIG['server_ip'],
                    username=SERVER_CONFIG['server_user'],
                    key_filename=SERVER_CONFIG['ssh_key']
                )
                log("✓ Подключение к серверу установлено", "OK")
                
                # chmod
                chmod_command = "sudo chmod -R 755 /var/www/dist"
                stdin, stdout, stderr = ssh.exec_command(chmod_command)
                chmod_error = stderr.read().decode()
                if chmod_error:
                    log(f"⚠ Ошибка chmod: {chmod_error}", "WARNING")
                else:
                    log("✓ Права доступа установлены (755)", "OK")
                
                # restart nginx
                restart_command = "sudo systemctl restart nginx"
                stdin, stdout, stderr = ssh.exec_command(restart_command)
                restart_error = stderr.read().decode()
                if restart_error:
                    log(f"⚠ Ошибка restart nginx: {restart_error}", "WARNING")
                else:
                    log("✓ nginx перезапущен", "OK")
                
            finally:
                ssh.close()
                log("✓ SSH-подключение закрыто", "OK")
            
            success = True
            return True
            
        except subprocess.TimeoutExpired:
            log(f"⚠ Таймаут. Повтор через {retry_delay} сек...", "WARNING")
            time.sleep(retry_delay)
            
        except subprocess.CalledProcessError as e:
            log(f"⚠ Ошибка scp (код {e.returncode}): {e.stderr}", "WARNING")
            time.sleep(retry_delay)
            
        except Exception as e:
            log(f"⚠ Ошибка: {e}", "WARNING")
            time.sleep(retry_delay)
    
    log("❌ Все попытки загрузки завершились неудачей", "ERROR")
    return False


# ============================================================================
# ОСНОВНАЯ ФУНКЦИЯ
# ============================================================================

def main():
    """Основная функция деплоя"""
    print("=" * 80)
    print("  DEPLOY SCRIPT - React + Nginx")
    print(f"  Время: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Предупреждение о том, что НЕ загружается
    log("⚠ ВНИМАНИЕ: Папка public/ с отчётами НЕ загружается на сервер")
    log("⚠ Отчёты загружаются отдельно через upload_reports_to_server()")
    print("-" * 80)
    print()

    # Шаг 1: Проверка компонентов
    log("ШАГ 1/3: Проверка компонентов")
    print("-" * 80)
    if not check_prerequisites():
        log("❌ Проверка не пройдена. Завершение.", "ERROR")
        sys.exit(1)
    print()
    
    # Шаг 2: Сборка React
    log("ШАГ 2/3: Сборка React-проекта")
    print("-" * 80)
    if not build_react_project():
        log("❌ Сборка не удалась. Завершение.", "ERROR")
        sys.exit(1)
    print()
    
    # Шаг 3: Загрузка на сервер
    log("ШАГ 3/3: Загрузка на сервер")
    print("-" * 80)
    if not upload_dist_to_server():
        log("❌ Загрузка не удалась. Завершение.", "ERROR")
        sys.exit(1)
    print()
    
    # Успех
    print("=" * 80)
    log("✅ ДЕПЛОЙ УСПЕШНО ЗАВЕРШЁН!", "SUCCESS")
    print("=" * 80)
    print()
    print("Проверьте сайт: https://analytics-uvao.ru")
    print()


if __name__ == "__main__":
    main()
