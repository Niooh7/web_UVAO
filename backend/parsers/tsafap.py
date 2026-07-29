import os
import shutil
import time
import traceback

import pandas as pd
import pythoncom
import win32com.client
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

from ..config import BASE_DIR, directory, login_TSAFAP, password_TSAFAP, _running
from ..utils.helpers import upload_reports_to_server, keep_latest_files, clean_parcing_folder
from ..utils.status import _record_success, _record_failure


def parcing_tsafap():
    options = webdriver.ChromeOptions()
    prefs = {
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
        "credentials_enable_service": False,
        "profile.password_manager_enabled": False,
        "profile.default_content_setting_values.notifications": 2,
        "autofill.profile_enabled": False,
        "autofill.credit_card_enabled": False
    }
    options.add_experimental_option("prefs", prefs)
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument("--disable-save-password-bubble")
    options.add_argument("--disable-features=PasswordImport")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-infobars")

    driver = webdriver.Chrome(options=options)

    try:
        print("1. Открываем сайт...")
        driver.get("https://cafap.mos.ru/login")
        time.sleep(2)

        print("2. Нажимаем на кнопку входа...")
        login_btn = driver.find_element(By.XPATH,
                                        "/html/body/cafap-root/cafap-login/cafap-svg-background/div/div[1]/div/div[2]/div/div[2]/div[1]")
        login_btn.click()
        time.sleep(1)

        print("3. Вводим логин...")
        username_input = driver.find_element(By.ID, "username")
        username_input.send_keys(login_TSAFAP)
        time.sleep(1)

        print("4. Вводим пароль...")
        password_input = driver.find_element(By.ID, "login-form__password")
        password_input.send_keys(password_TSAFAP)
        time.sleep(1)

        print("5. Вход на сайт...")
        submit_btn = driver.find_element(By.XPATH,
                                         "/html/body/cafap-root/cafap-login/cafap-svg-background/div/div[1]/div/div[2]/div/form/div[3]/button")
        submit_btn.click()
        time.sleep(3)

        print("6. Открываем кабинет...")
        cabinet_btn = driver.find_element(By.XPATH,
                                          "/html/body/cafap-root/cafap-home/cafap-header-new/div[2]/div/div[1]/ul[2]/li")
        cabinet_btn.click()
        time.sleep(2)

        print("7. Выбираем период...")
        date_btn = driver.find_element(By.XPATH,
                                       "/html/body/cafap-root/cafap-home/cafap-cabinet/div/div[1]/form/div[3]/div/div[1]")
        date_btn.click()
        time.sleep(1)

        yesterday = datetime.now() - timedelta(days=1)
        date_str = yesterday.strftime("%d.%m.%Y")
        print(f"8. Вводим дату начала: {date_str}")

        start_date = driver.find_element(By.CSS_SELECTOR, ".start-date input")
        start_date.clear()
        start_date.send_keys(date_str)
        time.sleep(1)

        print(f"9. Вводим дату конца: {date_str}")
        end_date = driver.find_element(By.CSS_SELECTOR, ".end-date input")
        end_date.clear()
        end_date.send_keys(date_str)
        time.sleep(1)

        print("10. Применяем фильтр...")
        apply_btn = driver.find_element(By.XPATH,
                                        "/html/body/cafap-root/cafap-home/cafap-cabinet/div/div[1]/form/div[3]/div/div[2]/div[3]/div[2]/button[1]")
        apply_btn.click()
        time.sleep(2)

        print("11. Открываем список отчетов...")
        dropdown_btn = driver.find_element(By.XPATH,
                                           "/html/body/cafap-root/cafap-home/cafap-cabinet/div/div[1]/div[1]/cafap-dropdwn/div/div[1]")
        dropdown_btn.click()
        time.sleep(1)

        print("12. Выбираем 'Нарушения'...")
        violations_btn = driver.find_element(By.XPATH,
                                             "/html/body/cafap-root/cafap-home/cafap-cabinet/div/div[1]/div[1]/cafap-dropdwn/div/div[2]/div[3]/div/div[1]/a")
        violations_btn.click()
        time.sleep(2)

        print("13. Переходим на страницу кабинета...")
        driver.get("https://cafap.mos.ru/cabinet")
        time.sleep(30)

        print("14. Ищем последний файл...")
        report_icon = driver.find_element(By.CSS_SELECTOR, ".report-dropdown-icon")
        report_icon.click()
        time.sleep(2)

        reports = driver.find_elements(By.CSS_SELECTOR, ".report-item")

        excel_file = None
        for report in reports:
            try:
                if "process" in report.get_attribute("class"):
                    continue
                file_name_element = report.find_element(By.CSS_SELECTOR, ".report-name")
                file_name = file_name_element.get_attribute("title")
                if file_name and ".xlsx" in file_name:
                    excel_file = report
                    print(f"   Найден файл: {file_name}")
                    break
            except Exception:
                continue

        if excel_file:
            print("   Наводим мышь на файл...")
            actions = ActionChains(driver)
            actions.move_to_element(excel_file).perform()
            time.sleep(2)

            try:
                download_icon = excel_file.find_element(By.CSS_SELECTOR, ".ic, .ui-icon, [class*='download']")
                download_icon.click()
                print("   Скачивание началось...")
            except Exception:
                print("   Иконка не найдена, кликаем по файлу...")
                file_name_element = excel_file.find_element(By.CSS_SELECTOR, ".report-name")
                file_name_element.click()

            time.sleep(5)
            return True
        else:
            print("   Не найден Excel файл")
            return False

    except Exception as e:
        print(f"Ошибка при выгрузке ЦАФАП: {e}")
        driver.quit()
        return False
    finally:
        time.sleep(2)
        driver.quit()


def process_data_and_create_pivot(input_file, output_dir=None):
    yesterday = datetime.now() - timedelta(days=1)
    date_str = yesterday.strftime("%d.%m.%Y")

    now = datetime.now()
    date = now.strftime("%d.%m.%Y")
    time_str = now.strftime("%H-%M")

    base_filename = f"Нарушения ЦАФАП за {date_str} на {date} {time_str}"

    if output_dir is None:
        output_dir = os.path.join(BASE_DIR, 'TSAFAP')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    excel_output_path = os.path.join(output_dir, f"{base_filename}.xlsx")
    pdf_output_path = os.path.join(output_dir, f"{base_filename}.pdf")
    temp_file = os.path.join(output_dir, '_temp_data.xlsx')

    try:
        print(f"🔍 [TSAFAP] Обработка данных из: {input_file}")

        df = pd.read_excel(input_file, sheet_name="Детализированный", header=4)

        print(f"📊 Столбцы: {list(df.columns)}")
        print(f"📊 Строк до фильтрации: {len(df)}")

        df = df[df["Контрольный орган"] == "ЦАФАП"]
        df = df[df["Статус нарушения"] != "Не является нарушением"]
        df["Район"] = df["Район"].replace("Без района", "АВД ЮВАО")

        mapping = {
            "Жилищник Выхино Выхино-Жулебино": "Выхино-Жулебино",
            "Жилищник Капотня": "Капотня",
            "Жилищник Кузьминки": "Кузьминки",
            "Жилищник Лефортово": "Лефортово",
            "Жилищник Люблино": "Люблино",
            "Жилищник Марьино": "Марьино",
            "Жилищник Некрасовка": "Некрасовка",
            "Жилищник Нижегородский": "Нижегородский",
            "Жилищник Печатники": "Печатники",
            "Жилищник Рязанский": "Рязанский",
            "Жилищник Текстильщики": "Текстильщики",
            "Жилищник Южнопортовый": "Южнопортовый",
            "Управа Нижегородского района": "Нижегородский",
            "Управа района Лефортово города Москвы": "Лефортово",
            "Управа района Текстильщики": "Текстильщики",
            "Управа Рязанского района": "Рязанский",
            "Управа района Люблино города Москвы": "Люблино",
            "Управа района Марьино города Москвы": "Марьино",
            "Управа района Печатники города Москвы": "Печатники",
            "Управа района Выхино-Жулебино": "Выхино-Жулебино",
            "Управа Южнопортового района города Москвы": "Южнопортовый",
            "Управа района Кузьминки": "Кузьминки",
            "Управа района Капотня": "Капотня",
            "Управа района Некрасовка": "Некрасовка",
            "АвД ЮВАО": "АВД ЮВАО"
        }

        df["Район"] = df["Ответственный (ОИВ 1 уровня)"].map(mapping).fillna(df["Район"])

        print(f"📊 Строк после фильтрации: {len(df)}")

        with pd.ExcelWriter(temp_file, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name="Детализированный", index=False)

        print("🔍 [TSAFAP] Создание сводной таблицы...")
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

        workbook = excel.Workbooks.Open(os.path.abspath(temp_file))

        vba_code = f"""
Sub CreatePivot()
    Dim wsData As Worksheet
    Dim wsPivot As Worksheet
    Dim rngData As Range
    Dim pc As PivotCache
    Dim pt As PivotTable
    Dim lastRow As Long, lastCol As Long

    On Error Resume Next
    Set wsPivot = ThisWorkbook.Worksheets("Свод")
    If Not wsPivot Is Nothing Then
        Application.DisplayAlerts = False
        wsPivot.Delete
        Application.DisplayAlerts = True
    End If
    On Error GoTo 0

    Set wsData = ThisWorkbook.Worksheets("Детализированный")
    Set rngData = wsData.UsedRange

    Set wsPivot = ThisWorkbook.Worksheets.Add(Before:=wsData)
    wsPivot.Name = "Свод"

    Set pc = ThisWorkbook.PivotCaches.Create(SourceType:=xlDatabase, SourceData:=rngData)
    Set pt = pc.CreatePivotTable(TableDestination:=wsPivot.Range("A3"), TableName:="PivotTable1")

    With pt.PivotFields("Район")
        .Orientation = xlRowField
        .Position = 1
    End With

    With pt.PivotFields("Тип объекта (АСУ ОДС)")
        .Orientation = xlColumnField
        .Position = 1
    End With

    With pt.PivotFields("Район")
        .Orientation = xlDataField
        .Function = xlCount
        .Caption = "Количество"
    End With

    pt.ColumnGrand = True
    pt.RowGrand = True

    wsPivot.Rows("3:3").Hidden = True
    wsPivot.Range("A4").Value = "Район"

    lastRow = wsPivot.Cells(wsPivot.Rows.Count, 1).End(xlUp).Row
    lastCol = wsPivot.Cells(4, wsPivot.Columns.Count).End(xlToLeft).Column

    With wsPivot.Range(wsPivot.Cells(4, 1), wsPivot.Cells(lastRow, lastCol))
        .Borders.LineStyle = xlContinuous
        .Borders.Weight = xlThin
        .Borders.Color = RGB(0, 0, 0)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
    End With

    With wsPivot.Range(wsPivot.Cells(4, 1), wsPivot.Cells(4, lastCol))
        .Font.Bold = True
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
    End With

    With wsPivot.Range(wsPivot.Cells(lastRow, 1), wsPivot.Cells(lastRow, lastCol))
        .Font.Bold = True
        .Interior.Color = RGB(68, 114, 196)
        .Font.Color = RGB(255, 255, 255)
    End With

    wsPivot.Columns.AutoFit
    wsPivot.Range("A1") = "Сводка нарушений ЦАФАП от {date_str}"
    wsPivot.Range("A1").Font.Bold = True
    wsPivot.Range("A1").Font.Size = 14
End Sub
"""

        vbproject = workbook.VBProject
        component = vbproject.VBComponents.Add(1)
        component.CodeModule.AddFromString(vba_code)

        excel.Application.Run("CreatePivot")

        try:
            vbproject.VBComponents.Remove(component)
        except Exception:
            pass

        workbook.SaveAs(excel_output_path, FileFormat=51)
        print(f"✅ [TSAFAP] Excel сохранен: {excel_output_path}")

        print("🔍 [TSAFAP] Создание PDF...")
        wsPivot = workbook.Worksheets("Свод")

        wsPivot.PageSetup.FitToPagesWide = 1
        wsPivot.PageSetup.FitToPagesTall = 1
        wsPivot.PageSetup.Zoom = False
        wsPivot.PageSetup.LeftMargin = excel.Application.CentimetersToPoints(0.5)
        wsPivot.PageSetup.RightMargin = excel.Application.CentimetersToPoints(0.5)
        wsPivot.PageSetup.TopMargin = excel.Application.CentimetersToPoints(0.5)
        wsPivot.PageSetup.BottomMargin = excel.Application.CentimetersToPoints(0.5)

        workbook.Save()

        if os.path.exists(pdf_output_path):
            os.remove(pdf_output_path)

        wsPivot.ExportAsFixedFormat(0, pdf_output_path)
        print(f"✅ [TSAFAP] PDF создан: {pdf_output_path}")

        workbook.Close(SaveChanges=False)
        excel.Quit()

        if os.path.exists(temp_file):
            os.remove(temp_file)

        print(f"✅ [TSAFAP] Обработка завершена успешно!")
        return excel_output_path, pdf_output_path

    except Exception as e:
        print(f"❌ [TSAFAP] Ошибка в process_data_and_create_pivot: {e}")
        traceback.print_exc()
        return None, None
    finally:
        try:
            if 'workbook' in locals():
                workbook.Close(SaveChanges=False)
            if 'excel' in locals():
                excel.Quit()
            if os.path.exists(temp_file):
                os.remove(temp_file)
        except Exception:
            pass


def tsafap():
    if _running['tsafap']:
        print("[tsafap] Пропуск: предыдущий запуск ещё выполняется")
        return
    _running['tsafap'] = True
    _coinit = False
    try:
        if not parcing_tsafap():
            _record_failure('tsafap', 'Парсер не смог загрузить данные')
            return
        pythoncom.CoInitialize()
        _coinit = True
        files = os.listdir(directory)
        files.sort(key=lambda x: os.path.getmtime(os.path.join(directory, x)))
        latest_downloaded_file = files[-1]
        source_path = os.path.join(directory, latest_downloaded_file)

        desktop_folder = os.path.join(os.path.expanduser("~"), "Desktop", "parcing")
        os.makedirs(desktop_folder, exist_ok=True)
        dest_path = os.path.join(desktop_folder, latest_downloaded_file)
        shutil.move(source_path, dest_path)
        filepath = dest_path

        print("🔍 [TSAFAP] Обработка данных...")
        excel_path, pdf_path = process_data_and_create_pivot(filepath)

        if not excel_path:
            print("❌ [TSAFAP] Ошибка обработки данных - Excel файл не создан")
            return

        print(f"✅ [TSAFAP] Excel файл создан: {excel_path}")
        print(f"✅ [TSAFAP] PDF файл создан: {pdf_path}")

        print("🔍 [TSAFAP] Загрузка отчётов на сервер...")
        files_to_upload = [excel_path]
        if pdf_path and os.path.exists(pdf_path):
            files_to_upload.append(pdf_path)

        if upload_reports_to_server('TSAFAP', files_to_upload):
            print("✔ [TSAFAP] Отчёты загружены на сервер")
        else:
            print("⚠ [TSAFAP] Не удалось загрузить отчёты на сервер")

        tsafap_dir = os.path.join(BASE_DIR, 'TSAFAP')
        keep_latest_files(tsafap_dir, 'TSAFAP')
        clean_parcing_folder()
        print("✅ [TSAFAP] Процесс завершен успешно!")
        _record_success('tsafap')

    except Exception as e:
        print(f"❌ [TSAFAP] Ошибка в tsafap: {e}")
        traceback.print_exc()
        _record_failure('tsafap', str(e))
    finally:
        if _coinit:
            pythoncom.CoUninitialize()
        _running['tsafap'] = False
