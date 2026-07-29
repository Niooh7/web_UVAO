"""
mmonitor.py — адаптирован для TDM (убраны зависимости от Telegram).
Парсинг и обработка данных Монитора Мэра (arm-mmonitor.mos.ru).
"""

import os
import re
import time
import shutil
from datetime import datetime, timedelta

import pandas as pd
from dotenv import load_dotenv

try:
    import pythoncom
    PYTHONCOM_AVAILABLE = True
except ImportError:
    PYTHONCOM_AVAILABLE = False

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager

from openpyxl import load_workbook
from openpyxl.styles import Border, Side, Alignment, Font, PatternFill
from openpyxl.formatting.rule import CellIsRule

try:
    import win32com.client
    WIN32COM_AVAILABLE = True
except ImportError:
    WIN32COM_AVAILABLE = False

home_dir  = os.path.expanduser("~")
directory = os.path.join(home_dir, "Downloads")

load_dotenv()
login_MM    = os.getenv("login_MM")
password_MM = os.getenv("password_MM")


# ──────────────────────────────────────────────
# Парсинг (синхронный)
# ──────────────────────────────────────────────

def parcing_data_MM_sync(MM_start_date: str, MM_end_date: str,
                         on_error=None) -> bool:
    """
    Синхронный парсинг Монитора Мэра.
    on_error(text) — опциональный callback для сообщения об ошибке.
    """
    chrome_install    = ChromeDriverManager().install()
    folder            = os.path.dirname(chrome_install)
    chromedriver_path = os.path.join(folder, "chromedriver.exe")
    driver            = webdriver.Chrome(service=ChromeService(chromedriver_path))
    driver.maximize_window()

    try:
        driver.get("https://arm-mmonitor.mos.ru")
        time.sleep(0.5)

        username = driver.find_element(By.XPATH, "/html/body/main/div/div[2]/div/form[1]/div[1]/div/input")
        password = driver.find_element(By.XPATH, "/html/body/main/div/div[2]/div/form[1]/div[2]/div/input")
        username.send_keys(login_MM)
        password.send_keys(password_MM)

        login_button = driver.find_element(By.XPATH, "/html/body/main/div/div[2]/div/form[1]/div[5]/div[1]/button")
        login_button.click()


        WebDriverWait(driver, 20).until(EC.presence_of_element_located(
            (By.XPATH, "/html/body/div/div/section/section/main/div/div[1]/div[2]/span[1]")))
        time.sleep(0.3)

        driver.find_element(By.XPATH,
            "/html/body/div/div/section/section/main/div/div[1]/div[2]/span[1]").click()

        driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[1]/label[3]/div/div").click()
        time.sleep(0.5)

        driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[1]/label[3]/div/div/div[2]/div/div/div/div[2]/div[1]/div/div/div[3]").click()
        time.sleep(1)

        b1 = driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[1]/div[3]/label/div/div[1]/div/input")
        b1.click(); b1.send_keys(Keys.CONTROL + "a"); b1.send_keys(Keys.BACKSPACE)
        time.sleep(0.3)
        b1.send_keys(MM_start_date)
        time.sleep(0.5)

        b2 = driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[1]/div[3]/label/div/div[2]/div/input")
        b2.click(); b2.send_keys(Keys.CONTROL + "a"); b2.send_keys(Keys.BACKSPACE)
        time.sleep(0.3)
        b2.send_keys(MM_end_date)

        driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[1]/label[12]/div").click()
        time.sleep(0.5)

        driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[1]/label[12]/div/div[2]/div/div/div/div[2]/div[1]/div/div/div[2]").click()
        time.sleep(0.5)

        driver.find_element(By.XPATH,
            "/html/body/div[2]/div/div[2]/div/div/div[2]/div[2]/button[1]").click()
        time.sleep(0.5)

        driver.find_element(By.TAG_NAME, "body").click()
        time.sleep(0.5)

        driver.find_element(By.CSS_SELECTOR, "svg.icon.xls-icon").click()
        time.sleep(0.5)

        driver.get("https://arm-mmonitor.mos.ru/#/export-files")

        for i in range(70):
            try:
                el = WebDriverWait(driver, 3).until(EC.visibility_of_element_located((By.XPATH,
                    "/html/body/div/div/section/section/main/div/div/div[1]/div/div/div/div"
                    "/div[2]/table/tbody/tr[3]/td[5]/div/button/span")))
                time.sleep(1)
                el.click()
                print("Файл MM готов к скачиванию.")
                break
            except Exception:
                driver.refresh()
                time.sleep(3)

        time.sleep(6)
        return True

    except Exception as e:
        msg = f"❌ Ошибка при выгрузке ММ: {e}"
        print(msg)
        if on_error:
            on_error(msg)
        return False
    finally:
        driver.quit()


# Обратная совместимость — async-обёртка для кода, который её вызывает
async def parcing_data_MM(context, chat_id, MM_start_date, MM_end_date):
    """Async-обёртка (совместимость с оригинальным кодом)."""
    import asyncio
    loop    = asyncio.get_event_loop()
    success = await loop.run_in_executor(
        None,
        lambda: parcing_data_MM_sync(MM_start_date, MM_end_date)
    )
    return success


# ──────────────────────────────────────────────
# Выбор временного периода
# ──────────────────────────────────────────────

def choosing_time_MM() -> str:
    today        = datetime.now()
    current_date = pd.Timestamp(datetime.now().date())

    ranges = [
        (current_date + pd.Timedelta(hours=0),
         current_date + pd.Timedelta(hours=10, minutes=59, seconds=59), "УТРО"),
        (current_date + pd.Timedelta(hours=11),
         current_date + pd.Timedelta(hours=14, minutes=59, seconds=59), "ДЕНЬ"),
        (current_date + pd.Timedelta(hours=15),
         current_date + pd.Timedelta(hours=19, minutes=59, seconds=59), "ВЕЧЕР"),
        (current_date + pd.Timedelta(hours=20),
         current_date + pd.Timedelta(hours=23, minutes=59, seconds=59), "НОЧЬ"),
    ]
    for start, end, label in ranges:
        if start <= today <= end:
            return label
    return "ДЕНЬ"


# ──────────────────────────────────────────────
# Атрибуты (логика классификации записей)
# ──────────────────────────────────────────────

def first_attribute(df):
    today         = datetime.now()
    weekday       = today.weekday()
    start_of_week = today - timedelta(days=weekday)
    base          = (df["Просрок"] == "Да") & (df["Статус в системе"] == "Устранено")

    if weekday == 0:
        cond = df["Срок устранения до"].dt.date == today.date()
        label = f"Устранено с нарушением срока {today.strftime('%d.%m.%y')} (На текущей уб. неделе)"
    else:
        offset    = weekday if weekday <= 5 else 5
        start_day = start_of_week + timedelta(days=(weekday - offset))
        cond  = (
            ((df["Срок устранения до"].dt.date >= start_day.date()) &
             (df["Срок устранения до"].dt.date <= today.date()))
            | (df["Срок устранения до"].dt.date < start_day.date())
        )
        label = (f"Устранено с нарушением срока {start_day.strftime('%d.%m.%y')}"
                 f" по {today.strftime('%d.%m.%y')} (На текущей уб. неделе)")

    df.loc[base & cond, "ТипСПросроком"] = label
    return df


def second_attribute(df):
    today         = datetime.now()
    weekday       = today.weekday()
    start_of_week = today - timedelta(days=weekday)
    base          = (df["Просрок"] == "Да") & (df["Статус в системе"] == "В работе")

    if weekday == 6:
        start_day = today - timedelta(days=6)
        cond  = ((df["Срок устранения до"].dt.date >= start_day.date()) &
                 (df["Срок устранения до"].dt.date <= today.date()))
        label = (f"В работе с просроком {start_day.strftime('%d.%m.%y')}"
                 f" по {today.strftime('%d.%m.%y')} (Текущая уб. неделя)")
    elif weekday == 0:
        cond  = df["Срок устранения до"].dt.date == today.date()
        label = f"В работе с просроком {today.strftime('%d.%m.%y')} (Текущая уб. неделя)"
    else:
        offsets   = [0, -1, -2, -3, -4, -5]
        start_day = start_of_week + timedelta(days=offsets[weekday] if weekday <= 5 else 0)
        cond  = ((df["Срок устранения до"].dt.date >= start_day.date()) &
                 (df["Срок устранения до"].dt.date <= today.date()))
        label = (f"В работе с просроком {start_day.strftime('%d.%m.%y')}"
                 f" по {today.strftime('%d.%m.%y')} (Текущая уб. неделя)")

    df.loc[base & cond, "ТипСПросроком"] = label


def third_attribute(df):
    today   = datetime.now()
    weekday = today.weekday()
    if weekday == 0:
        end_lw   = today - timedelta(days=1)
        start_lw = end_lw - timedelta(days=6)
    else:
        end_lw   = today - timedelta(days=(weekday + 1))
        start_lw = end_lw - timedelta(days=6)

    cond = (
        (df["Срок устранения до"].dt.date >= start_lw.date()) &
        (df["Срок устранения до"].dt.date <= end_lw.date()) &
        (df["Просрок"] == "Да") & (df["Статус в системе"] == "В работе")
    )
    df.loc[cond, "ТипСПросроком"] = (
        f"В работе с просроком с {start_lw.strftime('%d.%m.%y')}"
        f" по {end_lw.strftime('%d.%m.%y')} (Прошедшая уб. неделя)"
    )


def fourth_attribute(df):
    today         = datetime.now()
    weekday       = today.weekday()
    earliest_date = df["Срок устранения до"].min()
    if weekday == 0:
        end_lw      = today - timedelta(days=1)
        end_lw_mon  = end_lw - timedelta(days=7)
    else:
        end_lw      = today - timedelta(days=(weekday + 1))
        end_lw_mon  = end_lw - timedelta(days=7)

    cond = (
        (df["Срок устранения до"].dt.date >= earliest_date.date()) &
        (df["Срок устранения до"].dt.date <= end_lw_mon.date()) &
        (df["Просрок"] == "Да") & (df["Статус в системе"] == "В работе")
    )
    df.loc[cond, "ТипСПросроком"] = (
        f"В работе с просроком с {earliest_date.strftime('%d.%m.%y')}"
        f" по {end_lw_mon.strftime('%d.%m.%y')} (Старые)"
    )


def fifth_attribute(df):
    today = datetime.now()
    df.loc[
        (df["Срок устранения до"].dt.date == today.date()) &
        (df["Просрок"] == "Нет") & (df["Статус в системе"] == "В работе"),
        "ТипБезПросрока"
    ] = f"Срок с {pd.Timestamp(datetime.now()).strftime('%H:%M')} {today.strftime('%d.%m.%y')} (Сегодня)"


def sixth_attribute(df):
    today    = datetime.now()
    tomorrow = today + timedelta(days=1)
    max_date = df[(df["Просрок"] == "Нет") &
                  (df["Статус в системе"] == "В работе")]["Срок устранения до"].max()
    cond = (
        ((df["Срок устранения до"].dt.date >= tomorrow.date()) &
         (df["Срок устранения до"].dt.date <= max_date.date()) &
         (df["Просрок"] == "Нет") & (df["Статус в системе"] == "В работе"))
        |
        ((df["Обещание устранения"].dt.date >= tomorrow.date()) &
         (df["Обещание устранения"].dt.date <= max_date.date()) &
         (df["Просрок"] == "Нет") & (df["Статус в системе"] == "В работе"))
    )
    df.loc[cond, "ТипБезПросрока"] = (
        f"Срок с {tomorrow.strftime('%d.%m.%y')} по {max_date.strftime('%d.%m.%y')}"
    )


def snow_today(df):
    today = datetime.now()
    df.loc[
        (df["Дата фиксации нарушения"].dt.date == today.date()) &
        (df["Проблема"].isin(["Наличие снега, наледи", "Неочищенная кровля"])),
        "ТипСнег"
    ] = f"Снег {today.strftime('%d.%m.%y')} (Сегодня)"


def snow_all_expect_today(df):
    today    = datetime.now()
    tomorrow = today - timedelta(days=1)
    weekday  = today.weekday()
    start_of_week = today - timedelta(days=weekday)
    snow_cond = df["Проблема"].isin(["Наличие снега, наледи", "Неочищенная кровля"])

    if weekday == 6:
        start_day = today - timedelta(days=6)
        label = f"Снег с {start_day.strftime('%d.%m.%y')} по {tomorrow.strftime('%d.%m.%y')} (Текущая уб. неделя)"
    elif weekday == 1:
        start_day = start_of_week
        label = f"Снег {tomorrow.strftime('%d.%m.%y')} (Текущая уб. неделя)"
    else:
        offset    = weekday - (weekday if weekday <= 5 else 5)
        start_day = start_of_week + timedelta(days=offset)
        label = f"Снег с {start_day.strftime('%d.%m.%y')} по {tomorrow.strftime('%d.%m.%y')} (Текущая уб. неделя)"

    cond = snow_cond & (
        (df["Дата фиксации нарушения"].dt.date >= start_day.date()) &
        (df["Дата фиксации нарушения"].dt.date <= tomorrow.date())
    )
    df.loc[cond, "ТипСнег"] = label


# ──────────────────────────────────────────────
# Основная обработка файла
# ──────────────────────────────────────────────

def process_file_MM(filepath: str, timenow: str):
    df = pd.read_excel(filepath)

    wanted_values = [
        "ГБУ «Автомобильные дороги ЮВАО»",
        "ГБУ «Жилищник Выхино района Выхино-Жулебино»",
        "ГБУ «Жилищник Нижегородского района»",
        "ГБУ «Жилищник района Капотня»",
        "ГБУ «Жилищник района Кузьминки»",
        "ГБУ «Жилищник района Лефортово»",
        "ГБУ «Жилищник района Люблино»",
        "ГБУ «Жилищник района Марьино»",
        "ГБУ «Жилищник района Некрасовка»",
        "ГБУ «Жилищник района Печатники»",
        "ГБУ «Жилищник района Текстильщики»",
        "ГБУ «Жилищник района Южнопортовый»",
        "ГБУ «Жилищник Рязанского района»",
    ]
    df = df[df["Балансодержатель"].isin(wanted_values)]

    responsible_mapping = {
        "ГБУ «Автомобильные дороги ЮВАО»":               "АВД ЮВАО",
        "ГБУ «Жилищник Выхино района Выхино-Жулебино»":  "Выхино-Жулебино",
        "Управа района Выхино-Жулебино":                  "Выхино-Жулебино",
        "ГБУ «Жилищник Нижегородского района»":           "Нижегородский",
        "Управа Нижегородского района":                   "Нижегородский",
        "ГБУ «Жилищник района Капотня»":                  "Капотня",
        "Управа района Капотня":                           "Капотня",
        "ГБУ «Жилищник района Кузьминки»":                "Кузьминки",
        "Управа района Кузьминки":                         "Кузьминки",
        "ГБУ «Жилищник района Лефортово»":                "Лефортово",
        "Управа района Лефортово":                         "Лефортово",
        "ГБУ «Жилищник района Люблино»":                  "Люблино",
        "Управа района Люблино":                           "Люблино",
        "ГБУ «Жилищник района Марьино»":                  "Марьино",
        "Управа района Марьино":                           "Марьино",
        "ГБУ «Жилищник района Некрасовка»":               "Некрасовка",
        "Управа района Некрасовка":                        "Некрасовка",
        "ГБУ «Жилищник района Печатники»":                "Печатники",
        "Управа района Печатники":                         "Печатники",
        "ГБУ «Жилищник района Текстильщики»":             "Текстильщики",
        "Управа района Текстильщики":                      "Текстильщики",
        "ГБУ «Жилищник Рязанского района»":               "Рязанский",
        "Управа Рязанского района":                        "Рязанский",
        "ГБУ «Жилищник района Южнопортовый»":             "Южнопортовый",
        "Управа Южнопортового района":                     "Южнопортовый",
    }
    df["Район"] = df["Ответственный исполнитель"].map(responsible_mapping)

    df["Срок устранения до"]   = pd.to_datetime(df["Срок устранения до"])
    df["Обещание устранения"]  = pd.to_datetime(df["Обещание устранения"])
    df["ТипБезПросрока"] = ""
    df["ТипСПросроком"]  = ""
    df["ТипСнег"]        = ""

    first_attribute(df)
    second_attribute(df)
    third_attribute(df)
    fourth_attribute(df)
    fifth_attribute(df)
    sixth_attribute(df)

    has_snow = not df[df["Проблема"].isin(["Наличие снега, наледи", "Неочищенная кровля"])].empty
    if has_snow:
        snow_today(df)
        snow_all_expect_today(df)

    processed_file_path = os.path.join(
        directory, f"Монитор в работе {timenow}.xlsx"
    )
    with pd.ExcelWriter(processed_file_path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="СВОД", index=False, startrow=0)

    if not WIN32COM_AVAILABLE:
        print("win32com недоступен — PDF и сводные таблицы не будут созданы.")
        return processed_file_path, None, df

    vba_macro = _vba_pivot1()
    vba_macro2 = _vba_pivot2()
    vba_macro_snow = _vba_pivot_snow()

    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = True
    workbook = excel.Workbooks.Open(os.path.abspath(processed_file_path))

    _run_vba(excel, workbook, vba_macro,  "CreatePivotTable1")
    _run_vba(excel, workbook, vba_macro2, "CreatePivotTable2")
    if has_snow:
        _run_vba(excel, workbook, vba_macro_snow, "CreatePivotTableSnow")

    pdf_file_name = f"Монитор в работе {timenow}.pdf"
    pdf_path      = os.path.join(os.path.dirname(processed_file_path), pdf_file_name)

    wsFirst = workbook.Worksheets(1)
    _setup_page(excel, wsFirst)
    workbook.Save()

    _export_pdf(wsFirst, pdf_path)

    workbook.Worksheets(2).Cells.EntireColumn.AutoFit()
    workbook.Save()
    workbook.Close()
    excel.Quit()

    return processed_file_path, pdf_path, df


# ──────────────────────────────────────────────
# Вспомогательные функции для VBA / PDF
# ──────────────────────────────────────────────

def _run_vba(excel, workbook, vba_code: str, macro_name: str):
    mod = workbook.VBProject.VBComponents.Add(1)
    mod.CodeModule.AddFromString(vba_code)
    excel.Application.Run(macro_name)


def _setup_page(excel, ws):
    ws.PageSetup.FitToPagesWide = 1
    ws.PageSetup.FitToPagesTall = 1
    ws.PageSetup.Zoom = False
    ws.PageSetup.LeftMargin   = excel.Application.CentimetersToPoints(0.5)
    ws.PageSetup.RightMargin  = excel.Application.CentimetersToPoints(0.5)
    ws.PageSetup.TopMargin    = excel.Application.CentimetersToPoints(0.5)
    ws.PageSetup.BottomMargin = excel.Application.CentimetersToPoints(0.5)


def _export_pdf(ws, pdf_path: str):
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
    try:
        ws.ExportAsFixedFormat(0, pdf_path)
        print(f"PDF создан: {pdf_path}")
    except Exception as e:
        print(f"Ошибка создания PDF: {e}")


def _vba_pivot1() -> str:
    return """
Sub CreatePivotTable1()
    Dim wsData As Worksheet, wsPivot As Worksheet
    Dim pivotCache As PivotCache, pivotTable As PivotTable
    Dim lastRow As Long, lastCol As Long
    Dim foundTodayColumn As Boolean, cell As Range

    Set wsData = ThisWorkbook.Sheets("СВОД")
    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Sheets("Сводная таблица").Delete
    Application.DisplayAlerts = True
    On Error GoTo 0
    Set wsPivot = ThisWorkbook.Sheets.Add
    wsPivot.Name = "Сводная таблица"

    lastRow = wsData.Cells(wsData.Rows.Count, "A").End(xlUp).Row
    lastCol = wsData.Cells(1, wsData.Columns.Count).End(xlToLeft).Column

    Set pivotCache = ThisWorkbook.PivotCaches.Create(xlDatabase, wsData.Cells(1,1).Resize(lastRow, lastCol))
    Set pivotTable = pivotCache.CreatePivotTable(wsPivot.Cells(3,1), "MyPivotTable")

    With pivotTable
        .PivotFields("Район").Orientation = xlRowField
        .PivotFields("ТипБезПросрока").Orientation = xlColumnField
        .AddDataField .PivotFields("ID нарушения"), "Количество", xlCount
        .GrandTotalName = "На устранении без просрока"
    End With
    wsPivot.Range("A4").Value = "Район"
    wsPivot.Rows(3).Hidden = True

    Dim typePivotField As PivotField
    Set typePivotField = pivotTable.PivotFields("ТипБезПросрока")
    For Each item In typePivotField.PivotItems
        If item.Name = "(blank)" Then item.Visible = False
    Next item
    pivotTable.RefreshTable

    Dim rng As Range
    Set rng = wsPivot.Range("A4").CurrentRegion
    With rng
        .Font.Name = "Times New Roman": .Font.Size = 14: .Font.Bold = True
        .Borders.LineStyle = xlContinuous: .WrapText = True
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
    End With

    wsPivot.Columns("A").ColumnWidth = 24
    wsPivot.Range("6:16").RowHeight = 19
    wsPivot.Columns("B").ColumnWidth = 39: wsPivot.Columns("C").ColumnWidth = 34
    wsPivot.Columns("D").ColumnWidth = 33: wsPivot.Columns("E").ColumnWidth = 39

    foundTodayColumn = False
    For Each cell In wsPivot.Range("B4:E4")
        If InStr(1, cell.Value, "Сегодня", vbTextCompare) > 0 Then
            foundTodayColumn = True
            cell.Font.Color = RGB(255, 0, 0)
            Dim dataRange As Range, lastDataRow2 As Long
            lastDataRow2 = wsPivot.Cells(wsPivot.Rows.Count, cell.Column).End(xlUp).Row - 1
            Set dataRange = wsPivot.Range(cell.Offset(1, 0), wsPivot.Cells(lastDataRow2, cell.Column))
            For Each dataCell In dataRange
                If IsNumeric(dataCell.Value) And dataCell.Value > 0 Then
                    dataCell.Interior.Color = RGB(247, 134, 126)
                End If
            Next dataCell
        End If
    Next cell
End Sub
"""


def _vba_pivot2() -> str:
    return """
Sub CreatePivotTable2()
    Dim wsData As Worksheet, wsPivot As Worksheet
    Dim pivotCache As PivotCache, pivotTable As PivotTable
    Dim lastRow As Long, lastCol As Long, pivotStartRow As Long

    Set wsData  = ThisWorkbook.Sheets("СВОД")
    Set wsPivot = ThisWorkbook.Sheets("Сводная таблица")

    lastRow = wsData.Cells(wsData.Rows.Count, "A").End(xlUp).Row
    lastCol = wsData.Cells(1, wsData.Columns.Count).End(xlToLeft).Column
    pivotStartRow = wsPivot.Cells(wsPivot.Rows.Count, 1).End(xlUp).Row + 3

    Set pivotCache = ThisWorkbook.PivotCaches.Create(xlDatabase, wsData.Cells(1,1).Resize(lastRow, lastCol))
    Set pivotTable = pivotCache.CreatePivotTable(wsPivot.Cells(pivotStartRow, 1), "MyPivotTableWithExpiration")

    With pivotTable
        .PivotFields("Район").Orientation = xlRowField
        .PivotFields("ТипСПросроком").Orientation = xlColumnField
        .AddDataField .PivotFields("ID нарушения"), "Количество", xlCount
        .GrandTotalName = "Сумма по просрочкам"
    End With
    wsPivot.Range(wsPivot.Cells(pivotStartRow+1,1), wsPivot.Cells(pivotStartRow+1,1)).Value = "Район"
    wsPivot.Rows(pivotStartRow).Hidden = True

    Dim typePivotField As PivotField
    Set typePivotField = pivotTable.PivotFields("ТипСПросроком")
    For Each item In typePivotField.PivotItems
        If item.Name = "(blank)" Then item.Visible = False
    Next item
    pivotTable.RefreshTable

    Dim rng As Range
    Set rng = wsPivot.Range(wsPivot.Cells(pivotStartRow+1,1), wsPivot.Cells(pivotStartRow+1,1)).CurrentRegion
    With rng
        .Font.Name = "Times New Roman": .Font.Size = 14: .Font.Bold = True
        .Borders.LineStyle = xlContinuous: .WrapText = True
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
    End With
    wsPivot.Columns("A").ColumnWidth = 24
    wsPivot.Rows(pivotStartRow+1).RowHeight = 53
    wsPivot.Rows(pivotStartRow+3).RowHeight = 19
    wsPivot.Columns("B").ColumnWidth = 39: wsPivot.Columns("C").ColumnWidth = 34
    wsPivot.Columns("D").ColumnWidth = 33: wsPivot.Columns("E").ColumnWidth = 39

    Dim col As Integer, cell As Range, found As Boolean, searchStrings As Variant
    searchStrings = Array("В работе с просроком")
    For col = 1 To rng.Columns.Count
        found = False
        For Each cell In rng.Columns(col).Cells
            If cell.Row > pivotStartRow And cell.Row < rng.Rows.Count + pivotStartRow Then
                If Not IsEmpty(cell.Value) Then
                    For Each searchString In searchStrings
                        If InStr(1, cell.Value, searchString, vbTextCompare) > 0 Then found = True: Exit For
                    Next searchString
                End If
            End If
            If found Then Exit For
        Next cell
        If found Then
            For Each cell In rng.Columns(col).Cells
                If cell.Row > pivotStartRow + 1 And cell.Row < rng.Rows.Count + pivotStartRow - 1 Then
                    cell.Font.Color = RGB(255, 0, 0)
                End If
            Next cell
        End If
    Next col
End Sub
"""


def _vba_pivot_snow() -> str:
    return """
Sub CreatePivotTableSnow()
    Dim wsData As Worksheet, wsPivot As Worksheet
    Dim pivotCache As PivotCache, pivotTable As PivotTable
    Dim lastRow As Long, lastCol As Long, pivotStartRow As Long

    Set wsData  = ThisWorkbook.Sheets("СВОД")
    Set wsPivot = ThisWorkbook.Sheets("Сводная таблица")

    lastRow = wsData.Cells(wsData.Rows.Count, "A").End(xlUp).Row
    lastCol = wsData.Cells(1, wsData.Columns.Count).End(xlToLeft).Column
    pivotStartRow = wsPivot.Cells(wsPivot.Rows.Count, 1).End(xlUp).Row + 3

    Set pivotCache = ThisWorkbook.PivotCaches.Create(xlDatabase, wsData.Cells(1,1).Resize(lastRow, lastCol))
    Set pivotTable = pivotCache.CreatePivotTable(wsPivot.Cells(pivotStartRow, 1), "Pivotsnow")

    With pivotTable
        .PivotFields("Район").Orientation = xlRowField
        .PivotFields("ТипСнег").Orientation = xlColumnField
        .AddDataField .PivotFields("ID нарушения"), "Количество", xlCount
        .GrandTotalName = "Сумма по снегу"
    End With
    wsPivot.Range(wsPivot.Cells(pivotStartRow+1,1), wsPivot.Cells(pivotStartRow+1,1)).Value = "Район"
    wsPivot.Rows(pivotStartRow).Hidden = True

    Dim typePivotField As PivotField
    Set typePivotField = pivotTable.PivotFields("ТипСнег")
    For Each item In typePivotField.PivotItems
        If item.Name = "(blank)" Then item.Visible = False
    Next item
    pivotTable.RefreshTable

    Dim rng As Range
    Set rng = wsPivot.Range("A39").CurrentRegion
    With rng
        .Font.Name = "Times New Roman": .Font.Size = 14: .Font.Bold = True
        .Borders.LineStyle = xlContinuous: .WrapText = True
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
    End With
    wsPivot.Columns("A").ColumnWidth = 24
    wsPivot.Range("40:52").RowHeight = 19
    wsPivot.Columns("B").ColumnWidth = 39: wsPivot.Columns("C").ColumnWidth = 34
    wsPivot.Columns("D").ColumnWidth = 33: wsPivot.Columns("E").ColumnWidth = 39

    Dim foundTodayColumn As Boolean, cell As Range
    foundTodayColumn = False
    For Each cell In wsPivot.Range("B37:C39")
        If InStr(1, cell.Value, "Сегодня", vbTextCompare) > 0 Then
            foundTodayColumn = True
            cell.Font.Color = RGB(255, 0, 0)
            Dim dataRange As Range, lastDataRow As Long
            lastDataRow = wsPivot.Cells(wsPivot.Rows.Count, cell.Column).End(xlUp).Row - 1
            Set dataRange = wsPivot.Range(cell.Offset(1, 0), wsPivot.Cells(lastDataRow, cell.Column))
            For Each dataCell In dataRange
                If IsNumeric(dataCell.Value) And dataCell.Value > 0 Then
                    dataCell.Interior.Color = RGB(247, 134, 126)
                End If
            Next dataCell
        End If
    Next cell
End Sub
"""



# ──────────────────────────────────────────────
# Синхронизация в БД
# ──────────────────────────────────────────────

def _sync_mm_data(df, timenow: str) -> None:
    """Сохраняет все строки выгрузки ММ в таблицу MM_prosrok (UPSERT по ID нарушения)."""
    import sqlite3
    from ..config import DATABASE_PATH

    # timeout=30 чтобы не падать с "database is locked" при параллельных запросах
    conn = sqlite3.connect(DATABASE_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS MM_prosrok (
            ID            TEXT PRIMARY KEY,
            Deadline      TEXT,
            District      TEXT,
            Problem       TEXT,
            Resource      TEXT,
            Status        TEXT,
            OIV           TEXT,
            Address       TEXT,
            ControlObject TEXT,
            ExportDate    TEXT,
            IsOverdue     TEXT
        )
    """)

    for col, coltype in [
        ("OIV",           "TEXT"),
        ("Address",       "TEXT"),
        ("ControlObject", "TEXT"),
        ("ExportDate",    "TEXT"),
        ("IsOverdue",     "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE MM_prosrok ADD COLUMN {col} {coltype}")
        except Exception:
            pass  # столбец уже существует

    conn.commit()

    id_col = "ID нарушения"
    if id_col not in df.columns:
        print(f"[mm_sync] Столбец '{id_col}' не найден в выгрузке — синхронизация пропущена")
        conn.close()
        return

    def _str(val):
        return str(val).strip() if pd.notna(val) else None

    rows_upserted = 0
    batch = []
    for _, row in df.iterrows():
        issue_id = str(row.get(id_col, "")).strip()
        if not issue_id or issue_id in ("nan", "None", ""):
            continue

        deadline_val = row.get("Срок устранения до")
        try:
            deadline = pd.Timestamp(deadline_val).strftime("%Y-%m-%d") if pd.notna(deadline_val) else None
        except Exception:
            deadline = None

        # OIV может быть в разных столбцах, пробуем варианты
        oiv = _str(row.get("ОИВ")) or _str(row.get("Ответственный ОИВ")) or ""

        batch.append((
            issue_id,
            deadline,
            _str(row.get("Район")),
            _str(row.get("Проблема")),
            _str(row.get("Система-источник")),
            _str(row.get("Статус в системе")),
            oiv,
            _str(row.get("Адрес")),
            _str(row.get("Объект контроля")),
            timenow,
            _str(row.get("Просрок")),
        ))
        rows_upserted += 1

    cur.executemany("""
        INSERT INTO MM_prosrok
            (ID, Deadline, District, Problem, Resource, Status, OIV, Address, ControlObject, ExportDate, IsOverdue)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ID) DO UPDATE SET
            Deadline      = excluded.Deadline,
            District      = excluded.District,
            Problem       = excluded.Problem,
            Resource      = excluded.Resource,
            Status        = excluded.Status,
            OIV           = excluded.OIV,
            Address       = excluded.Address,
            ControlObject = excluded.ControlObject,
            ExportDate    = excluded.ExportDate,
            IsOverdue     = excluded.IsOverdue
    """, batch)

    conn.commit()
    conn.close()
    print(f"[mm_sync] Синхронизировано строк: {rows_upserted}")


# ──────────────────────────────────────────────
# Точка входа для планировщика
# ──────────────────────────────────────────────

def mm(scheduled_time=None):
    from ..config import BASE_DIR, _running
    from ..utils.helpers import upload_reports_to_server, keep_latest_files, send_file_to_telegram
    from ..utils.status import _record_success, _record_failure

    if _running["mm"]:
        print("[mm] Пропуск: предыдущий запуск ещё выполняется")
        return
    _running["mm"] = True
    _coinit = False
    try:
        today = datetime.now()
        timenow = datetime.now().strftime("%d.%m.%Y %H-%M")
        monday = today - timedelta(days=today.weekday())
        start_date = monday.strftime("%d.%m.%Y") + "0000"
        end_date = today.strftime("%d.%m.%Y") + "2100"

        print(f"[mm] Запуск парсинга ММ... период {start_date} — {end_date}, время суток: {timenow}")
        success = parcing_data_MM_sync(start_date, end_date)
        if not success:
            _record_failure("mm", "Парсер не смог загрузить данные после всех попыток")
            return

        if PYTHONCOM_AVAILABLE:
            pythoncom.CoInitialize()
            _coinit = True

        files = sorted(
            [f for f in os.listdir(directory) if f.endswith(".xlsx")],
            key=lambda x: os.path.getmtime(os.path.join(directory, x))
        )
        if not files:
            _record_failure("mm", "Файл не найден в папке Downloads после парсинга")
            return
        latest_file = os.path.join(directory, files[-1])

        processed_path, pdf_path, df_mm = process_file_MM(latest_file, timenow)
        _sync_mm_data(df_mm, timenow)

        static_directory = os.path.join(BASE_DIR, "MM")
        os.makedirs(static_directory, exist_ok=True)

        processed_dest = os.path.join(static_directory, os.path.basename(processed_path))
        shutil.move(processed_path, processed_dest)
        upload_files = [processed_dest]

        if pdf_path:
            pdf_dest = os.path.join(static_directory, os.path.basename(pdf_path))
            shutil.move(pdf_path, pdf_dest)
            upload_files.append(pdf_dest)

        keep_latest_files(static_directory, 'MM', keep=5)
        upload_reports_to_server("MM", upload_files)

        special_times_mm = {"08:50", "12:50", "15:50", "20:50"}
        if scheduled_time in special_times_mm:
            print(f"[mm] Специальное время ({scheduled_time}) — отправляем в ТДМ")
            send_file_to_telegram(processed_dest, caption="Монитор в работе — Excel")
            if pdf_path:
                send_file_to_telegram(pdf_dest, caption="Монитор в работе — PDF")

        _record_success("mm")
        print("[mm] Завершено успешно.")

    except Exception as e:
        print(f"[mm] Ошибка: {e}")
        _record_failure("mm", str(e))
    finally:
        if _coinit and PYTHONCOM_AVAILABLE:
            pythoncom.CoUninitialize()
        _running["mm"] = False
