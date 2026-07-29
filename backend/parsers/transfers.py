import os
import re
import shutil
import sqlite3
import time

import pandas as pd
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService

from ..config import DATABASE_PATH, DB_DELAYS_PATH, directory, login_NG, password_NG
from ..utils.status import _get_chromedriver


def get_monday_of_current_week():
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    return monday


def parcing_delay_ng():
    driver = webdriver.Chrome(service=ChromeService(_get_chromedriver()))
    try:
        print("=== НАЧАЛО ПАРСИНГА НГ ===")

        driver.get('https://gorod.mos.ru/api/service/auth/auth')
        print("Страница логина загружена")

        username = driver.find_element(By.XPATH, '//input[@placeholder="Логин *"]')
        password = driver.find_element(By.XPATH, '//input[@placeholder="Пароль*"]')
        username.send_keys(login_NG)
        password.send_keys(password_NG)
        print("Логин и пароль введены")

        login_button = driver.find_element(By.XPATH, '/html/body/div[1]/div/div/main/div/div/div/div[2]/form[1]/button')
        login_button.click()
        print("Кнопка логина нажата")

        WebDriverWait(driver, 200).until(EC.presence_of_element_located((By.XPATH,
                                                                         '//div[@class="dashboard__block-link"]//div[@class="button-big link"]//div[@class="dashboard-container__links-title" and contains(text(), "Аналитика")]')))
        print("Успешный вход в систему")

        driver.get('https://gorod.mos.ru/admin/ker/olap/report/73')
        print("Переход на страницу переносов")
        time.sleep(7)

        date1 = get_monday_of_current_week()
        date2 = datetime.now()
        date1_formatted = date1.strftime('%d.%m.%Y')
        date2_formatted = date2.strftime('%d.%m.%Y')

        print(f"Даты для фильтра: {date1_formatted} - {date2_formatted}")

        element = driver.find_element(By.XPATH,
                                      '/html/body/div[3]/div/div[2]/div/div/div/div/form/div[2]/main/div[2]/div/div[1]/label/div/div[1]/div[2]/input')
        element.send_keys(Keys.CONTROL + 'a')
        element.send_keys(Keys.BACKSPACE)
        element.send_keys(date1_formatted)
        print("Дата начала введена")

        element = driver.find_element(By.XPATH,
                                      '/html/body/div[3]/div/div[2]/div/div/div/div/form/div[2]/main/div[2]/div/div[2]/label/div/div[1]/div[2]/input')
        element.send_keys(Keys.CONTROL + 'a')
        element.send_keys(Keys.BACKSPACE)
        element.send_keys(date2_formatted)
        print("Дата окончания введена")

        time.sleep(3)

        WebDriverWait(driver, 20).until(EC.presence_of_element_located(
            (By.XPATH, '/html/body/div[3]/div/div[2]/div/div/div/div/form/footer/button[3]/span[2]/span')))
        button = driver.find_element(By.XPATH,
                                     '/html/body/div[3]/div/div[2]/div/div/div/div/form/footer/button[3]/span[2]/span')
        button.click()
        print("Кнопка экспорта нажата")
        time.sleep(1)

        button = driver.find_element(By.XPATH, "//button[contains(@class, 'bg-primary')]//span[text()='Экспорт']")
        button.click()
        print("Подтверждение экспорта")
        time.sleep(1)

        # Переходим на страницу загрузок
        driver.get('https://gorod.mos.ru/admin/ker/olap/downloads')
        # ждём, пока в первой строке появится иконка скачивания
        icon = WebDriverWait(driver, 1500).until(
            EC.element_to_be_clickable((By.XPATH, "//table/tbody/tr[1]//i[text()='file_download']"))
        )
        icon.click()
        time.sleep(5)

        desktop_path = os.path.join(os.environ['USERPROFILE'], 'Desktop')
        target_folder = os.path.join(desktop_path, 'delays', 'ng')
        os.makedirs(target_folder, exist_ok=True)

        download_folder = os.path.abspath(os.path.expanduser('~\\Downloads'))
        downloaded_files = [f for f in os.listdir(download_folder) if os.path.isfile(os.path.join(download_folder, f))]
        print(f"Все файлы в папке загрузок: {downloaded_files}")

        xlsx_files = [f for f in downloaded_files if f.endswith('.xlsx')]
        if not xlsx_files:
            raise FileNotFoundError("Скачанный файл не найден в папке загрузок.")

        latest_file = max([os.path.join(download_folder, f) for f in xlsx_files], key=os.path.getctime)
        print(f"Найден файл: {latest_file}")

        new_file_name = f"Переносы_НГ_{datetime.now().strftime('%d.%m.%y')}.xlsx"
        target_file_path = os.path.join(target_folder, new_file_name)

        try:
            shutil.move(latest_file, target_file_path)
            print(f"Файл успешно перемещен: {target_file_path}")
        except Exception as e:
            print(f"Ошибка при перемещении файла: {e}")
            return False

        df = pd.read_excel(target_file_path)
        print(f"Файл прочитан, строк: {len(df)}")

        if 'Дата публикации ответа' in df.columns:
            df['Дата публикации ответа'] = pd.to_datetime(df['Дата публикации ответа'], errors='coerce')
            df['Дата публикации ответа'] = df['Дата публикации ответа'].dt.strftime('%d.%m.%Y')
            print("Даты преобразованы")

        if 'Ответственный за подготовку ответа' in df.columns and 'Район' in df.columns:
            df.loc[df['Ответственный за подготовку ответа'] == 'ГБУ «Автомобильные дороги ЮВАО»', 'Район'] = 'АВД ЮВАО'
            print("Районы обновлены")

        df.to_excel(target_file_path, index=False)
        print(f"Файл успешно сохранен: {target_file_path}")

        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        records_added = 0
        for _, row in df.iterrows():
            try:
                cursor.execute('''
                    INSERT OR REPLACE INTO delays_ng (ID, District, Type, Date_answer)
                    VALUES (?, ?, ?, ?)
                ''', (
                    str(row['Номер сообщения']),
                    str(row['Район']),
                    str(row['Категория/Действие ответа']),
                    str(row['Дата публикации ответа'])
                ))
                records_added += 1
            except sqlite3.IntegrityError:
                print(f"Запись с ID {row['Номер сообщения']} уже существует в базе данных.")
            except Exception as e:
                print(f"Ошибка при добавлении записи: {e}")

        conn.commit()
        conn.close()

        print(f"Данные успешно занесены в базу данных. Добавлено записей: {records_added}")
        return True

    except Exception as e:
        print(f"❌Произошла ошибка при выгрузке Ответы в работе(НГ): {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        driver.quit()
        print("Драйвер закрыт")


def update_transfer_statistics():
    try:
        print("=== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ СТАТИСТИКИ ПЕРЕНОСОВ ===")

        print("=== ОБНОВЛЕНИЕ ДАННЫХ НГ ===")
        ng_success = parcing_delay_ng()

        print("=== ПРОВЕРКА ДАННЫХ БОТА ===")
        conn_bot = sqlite3.connect(DB_DELAYS_PATH)
        cursor_bot = conn_bot.cursor()

        cursor_bot.execute("""
            SELECT COUNT(*)
            FROM requests
            WHERE status = 'Одобрено окончательно (модератор 1)'
        """)

        bot_total = cursor_bot.fetchone()[0]
        conn_bot.close()

        conn_ng = sqlite3.connect(DATABASE_PATH)
        cursor_ng = conn_ng.cursor()

        cursor_ng.execute("""
            SELECT COUNT(*)
            FROM delays_ng
        """)

        ng_total = cursor_ng.fetchone()[0]
        conn_ng.close()

        print(f"Статистика обновлена:")
        print(f"- Переносов через бота: {bot_total}")
        print(f"- Переносов через НГ: {ng_total}")

        if bot_total + ng_total > 0:
            bot_percentage = round((bot_total / (bot_total + ng_total) * 100), 2)
            print(f"- Доля переносов через бота: {bot_percentage}%")

        return True

    except Exception as e:
        print(f"Ошибка при обновлении статистики переносов: {e}")
        import traceback
        traceback.print_exc()
        return False
