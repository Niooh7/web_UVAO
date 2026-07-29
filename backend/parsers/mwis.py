import os
import shutil
import time

import pandas as pd
import pythoncom
import win32com.client
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService

from ..config import BASE_DIR, directory, login_NG, password_NG, _running
from ..utils.helpers import safe_excel_operation, upload_reports_to_server, keep_latest_files, clean_parcing_folder
from ..utils.status import _record_success, _record_failure, _get_chromedriver


def parcing_mji(attempts=2):
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())

    if today.weekday() == 0:
        last_monday = monday - timedelta(days=7)
        date1 = last_monday.strftime('%d.%m.%Y')
        date2 = (last_monday + timedelta(days=6)).strftime('%d.%m.%Y')
    else:
        date1 = monday.strftime('%d.%m.%Y')
        date2 = today.strftime('%d.%m.%Y')

    for attempt in range(1, attempts + 1):
        print(f"Попытка {attempt} из {attempts}")
        driver = webdriver.Chrome(service=ChromeService(_get_chromedriver()))
        driver.maximize_window()
        try:
            driver.get('https://gorod.mos.ru/api/service/auth/auth')

            username = driver.find_element(By.XPATH, '//input[@placeholder="Логин *"]')
            password = driver.find_element(By.XPATH, '//input[@placeholder="Пароль*"]')
            username.send_keys(login_NG)
            password.send_keys(password_NG)

            login_button = driver.find_element(By.XPATH,
                                               '/html/body/div[1]/div/div/main/div/div/div/div[2]/form[1]/button')
            login_button.click()
            WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.XPATH,
                                                                            '//div[@class="dashboard__block-link"]//div[@class="button-big link"]//div[@class="dashboard-container__links-title" and contains(text(), "Аналитика")]')))

            try:
                notification_button = WebDriverWait(driver, 3).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, '/html/body/div/div/div[4]/div/div/div[2]/div[2]/div/div/button'))
                )
                notification_button.click()
                print("Уведомление закрыто")
                time.sleep(1)
            except Exception:
                print("Уведомление не обнаружено, продолжаем работу")

            time.sleep(1)
            driver.get('https://er.mos.ru/ker/admin/issues/monitor_mzi?sidebar=organization')
            time.sleep(1)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[1]/main/div/div/div/div[3]/div/div/aside/div[1]/div/div[2]/div[3]/div[4]/div")
            button.click()
            time.sleep(1)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[1]/div/div[1]/div[1]/div[1]")
            button.click()
            time.sleep(1)
            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[1]/div[1]/div[1]/div[1]/div[1]/input")
            button.send_keys('ЮВАО')
            time.sleep(1)
            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[1]/div[2]/div/div/div[2]/div")
            button.click()
            time.sleep(1)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[3]/div[1]/div/div[1]/div[1]/input")
            button.click()
            button.send_keys(date1)
            time.sleep(0.5)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[4]/div[1]/div/div[1]/div[1]/input")
            button.click()
            button.send_keys(date2)
            time.sleep(1)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[2]/div/div[1]/div[1]/div[3]/div/i")
            button.click()
            time.sleep(1.5)
            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[2]/div[2]/div/div[1]/div[1]/i")
            button.click()
            time.sleep(1.5)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[6]/div[1]/div[1]/div[1]/div[2]")
            button.click()
            time.sleep(1.5)
            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[6]/div[2]/div/div[1]/div/div")
            button.click()
            time.sleep(1.5)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[7]/div/div[1]/div[1]/div[2]")
            button.click()
            time.sleep(1.5)
            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[1]/form/div[7]/div[2]/div/div[1]/div/div")
            button.click()
            time.sleep(1)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[3]/div/div/div[2]/div[2]/div/div/button[3]")
            button.click()
            time.sleep(2)

            WebDriverWait(driver, 1500).until(
                EC.presence_of_element_located((By.XPATH,
                                                '/html/body/div/div/div[1]/main/div/div/div/div[3]/div/div/div/div/div/div/div[1]/div[2]/div/div[1]/nav/ul/li[2]/button')))
            time.sleep(1)

            button = driver.find_element(By.XPATH,
                                         "/html/body/div/div/div[1]/main/div/div/div/div[3]/div/div/div/div/div/div/div[1]/div[1]/div[1]/div[2]/span[1]/button/span/i")
            button.click()
            time.sleep(2)

            driver.execute_script("document.querySelector('.v-overlay__scrim.white').style.display='none';")
            time.sleep(1)
            driver.execute_script("document.querySelector('.v-overlay.v-overlay--active').style.display='none';")
            time.sleep(1)

            option = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, '(//div[@class="v-select__selections"])[9]'))
            )
            option.click()
            time.sleep(2)

            option_to_select = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Все сообщения')]"))
            )
            option_to_select.click()
            time.sleep(2)

            export_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(span, 'Экспорт')]"))
            )
            export_button.click()
            time.sleep(3)

            driver.get('https://er.mos.ru/ker/admin/issues/monitor_mzi?sidebar=organization')
            time.sleep(3)
            # Переходим на страницу загрузок
            driver.get('https://gorod.mos.ru/admin/ker/olap/downloads')
            # ждём, пока в первой строке появится иконка скачивания
            icon = WebDriverWait(driver, 1500).until(
                EC.element_to_be_clickable((By.XPATH, "//table/tbody/tr[1]//i[text()='file_download']"))
            )
            icon.click()
            time.sleep(5)

            print("Парсинг завершен успешно.")
            return True
        except Exception as e:
            print(f"Ошибка при выгрузке Статистики МЖИ: {e}")
            driver.quit()
            if attempt == attempts:
                print("Парсинг не удался после всех попыток.")
                return False
        finally:
            driver.quit()


def process_mji(filepath):
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())

    if today.weekday() == 0:
        last_monday = monday - timedelta(days=7)
        date1 = last_monday.strftime('%d.%m.%Y')
        date2 = (last_monday + timedelta(days=6)).strftime('%d.%m.%Y')
    else:
        date1 = monday.strftime('%d.%m.%Y')
        date2 = today.strftime('%d.%m.%Y')

    gen_time = today.strftime('%H-%M')
    gen_date_str = today.strftime('%d.%m.%Y')
    gen_display = today.strftime('%H:%M')

    try:
        df = pd.read_excel(filepath)
    except Exception as e:
        print(f"ОШИБКА: Не удалось прочитать Excel файл в process_mji: {e}")
        raise

    def assign_type(row):
        if row['Категория ответа ОИВ'] == "Проблема устранена":
            return "А. Устранено с просроком" if row['Просрок Монитора'] == "Да" else "Г. Устранено без просрока"
        else:
            return "Б. В работе с просроком" if row['Просрок Монитора'] == "Да" else "В. В работе без просрока"

    df['Тип'] = df.apply(assign_type, axis=1)
    total_records_count = len(df)

    updated_filepath = os.path.join(directory, f"МЖИ {date1} - {date2} на {gen_date_str} {gen_time}.xlsx")
    df.to_excel(updated_filepath, index=False)

    vba_macro = f"""
Sub CreatePivotTable()
    Dim wsData As Worksheet
    Dim wsPivot As Worksheet
    Dim pivotCache As PivotCache
    Dim pt As PivotTable
    Dim pf As PivotField
    Dim pi As PivotItem
    Dim lastRow As Long
    Dim lastCol As Long
    Dim lastPivotCol As Integer
    Dim totalRow As Long
    Dim rng As Range
    Dim pRng As Range
    Dim fc As FormatCondition
    Dim colIdx As Integer
    Dim rIdx As Long
    Dim pos As Integer
    Dim legRow As Long
    Dim li As Integer
    Dim hVal As String
    Dim legText(3) As String
    Dim legColor(3) As Long

    Set wsData = ThisWorkbook.Sheets(1)

    On Error Resume Next
    Application.DisplayAlerts = False
    ThisWorkbook.Sheets("Сводная таблица").Delete
    Application.DisplayAlerts = True
    On Error GoTo 0

    Set wsPivot = ThisWorkbook.Sheets.Add(Before:=ThisWorkbook.Sheets(1))
    wsPivot.Name = "Сводная таблица"

    lastRow = wsData.Cells(wsData.Rows.Count, "A").End(xlUp).Row
    lastCol = wsData.Cells(1, wsData.Columns.Count).End(xlToLeft).Column

    Set pivotCache = ThisWorkbook.PivotCaches.Create( _
        SourceType:=xlDatabase, _
        SourceData:=wsData.Cells(1, 1).Resize(lastRow, lastCol))

    Set pt = pivotCache.CreatePivotTable( _
        TableDestination:=wsPivot.Cells(6, 1), _
        TableName:="МЖИСтат")

    With pt
        .PivotFields("Район").Orientation = xlRowField
        .PivotFields("Тип").Orientation = xlColumnField
        .AddDataField .PivotFields("Номер заявки"), "Количество", xlCount
    End With

    wsPivot.Rows(6).Hidden = True
    wsPivot.Range("A7").Value = "Район"

    Set pf = pt.PivotFields("Тип")
    For Each pi In pf.PivotItems
        If pi.Name = "(blank)" Or pi.Name = "" Then pi.Visible = False
    Next pi

    pos = 1
    On Error Resume Next
    pf.PivotItems("А. Устранено с просроком").Position = pos
    If Err.Number = 0 Then pos = pos + 1
    Err.Clear
    pf.PivotItems("Б. В работе с просроком").Position = pos
    If Err.Number = 0 Then pos = pos + 1
    Err.Clear
    pf.PivotItems("В. В работе без просрока").Position = pos
    If Err.Number = 0 Then pos = pos + 1
    Err.Clear
    pf.PivotItems("Г. Устранено без просрока").Position = pos
    Err.Clear
    On Error GoTo 0

    pt.RefreshTable

    lastPivotCol = wsPivot.Cells(7, wsPivot.Columns.Count).End(xlToLeft).Column
    totalRow = wsPivot.Cells(wsPivot.Rows.Count, 1).End(xlUp).Row

    wsPivot.Range("A1").Resize(1, lastPivotCol).Merge
    wsPivot.Range("A2").Resize(1, lastPivotCol).Merge

    With wsPivot.Cells(1, 1)
        .Value = "СТАТИСТИКА МЖИ  —  {date1} по {date2}"
        .Font.Name = "Times New Roman"
        .Font.Size = 16
        .Font.Bold = True
        .Font.Color = RGB(20, 40, 100)
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
    wsPivot.Rows(1).RowHeight = 30

    With wsPivot.Cells(2, 1)
        .Value = "Сформировано: {gen_date_str} {gen_display}  |  Всего записей: {total_records_count}"
        .Font.Name = "Times New Roman"
        .Font.Size = 10
        .Font.Italic = True
        .Font.Color = RGB(90, 95, 115)
        .HorizontalAlignment = xlLeft
        .IndentLevel = 1
    End With
    wsPivot.Rows(2).RowHeight = 18

    wsPivot.Range("A1").Resize(2, lastPivotCol).Interior.Color = RGB(238, 243, 255)
    With wsPivot.Range("A2").Resize(1, lastPivotCol).Borders(xlEdgeBottom)
        .LineStyle = xlContinuous
        .Color = RGB(100, 130, 200)
        .Weight = xlMedium
    End With

    wsPivot.Rows(3).RowHeight = 5
    wsPivot.Rows(4).RowHeight = 5
    wsPivot.Rows(5).RowHeight = 5

    Set rng = wsPivot.Range(wsPivot.Cells(7, 1), wsPivot.Cells(totalRow, lastPivotCol))
    With rng
        .Font.Name = "Times New Roman"
        .Font.Size = 11
        .Interior.Color = RGB(255, 255, 255)
        .HorizontalAlignment = xlCenter
        .VerticalAlignment = xlCenter
        .WrapText = True
    End With
    With rng.Borders
        .LineStyle = xlContinuous
        .Color = RGB(200, 205, 215)
        .Weight = xlThin
    End With
    rng.BorderAround xlContinuous, xlMedium, , RGB(100, 120, 170)

    wsPivot.Range(wsPivot.Cells(8, 1), wsPivot.Cells(totalRow, 1)).HorizontalAlignment = xlLeft
    wsPivot.Range(wsPivot.Cells(8, 1), wsPivot.Cells(totalRow, 1)).IndentLevel = 1

    For colIdx = 1 To lastPivotCol
        hVal = CStr(wsPivot.Cells(7, colIdx).Value)
        Select Case True
            Case hVal = "Район"
                wsPivot.Cells(7, colIdx).Interior.Color = RGB(28, 54, 110)
                wsPivot.Cells(7, colIdx).Font.Color = RGB(255, 255, 255)
                wsPivot.Cells(7, colIdx).Font.Bold = True
                wsPivot.Cells(7, colIdx).Font.Size = 12
            Case InStr(1, hVal, "А.", vbTextCompare) > 0
                wsPivot.Cells(7, colIdx).Interior.Color = RGB(180, 35, 35)
                wsPivot.Cells(7, colIdx).Font.Color = RGB(255, 255, 255)
                wsPivot.Cells(7, colIdx).Font.Bold = True
            Case InStr(1, hVal, "Б.", vbTextCompare) > 0
                wsPivot.Cells(7, colIdx).Interior.Color = RGB(190, 80, 10)
                wsPivot.Cells(7, colIdx).Font.Color = RGB(255, 255, 255)
                wsPivot.Cells(7, colIdx).Font.Bold = True
            Case InStr(1, hVal, "В.", vbTextCompare) > 0
                wsPivot.Cells(7, colIdx).Interior.Color = RGB(20, 90, 160)
                wsPivot.Cells(7, colIdx).Font.Color = RGB(255, 255, 255)
                wsPivot.Cells(7, colIdx).Font.Bold = True
            Case InStr(1, hVal, "Г.", vbTextCompare) > 0
                wsPivot.Cells(7, colIdx).Interior.Color = RGB(30, 115, 55)
                wsPivot.Cells(7, colIdx).Font.Color = RGB(255, 255, 255)
                wsPivot.Cells(7, colIdx).Font.Bold = True
            Case Else
                wsPivot.Cells(7, colIdx).Interior.Color = RGB(60, 65, 95)
                wsPivot.Cells(7, colIdx).Font.Color = RGB(255, 255, 255)
                wsPivot.Cells(7, colIdx).Font.Bold = True
        End Select
    Next colIdx
    wsPivot.Rows(7).RowHeight = 40

    For colIdx = 1 To lastPivotCol
        If InStr(1, CStr(wsPivot.Cells(7, colIdx).Value), "с просроком", vbTextCompare) > 0 Then
            Set pRng = wsPivot.Range(wsPivot.Cells(8, colIdx), wsPivot.Cells(totalRow - 1, colIdx))
            pRng.FormatConditions.Delete
            Set fc = pRng.FormatConditions.Add(xlCellValue, xlGreater, 0)
            fc.Interior.Color = RGB(255, 210, 210)
            fc.Font.Color = RGB(140, 0, 0)
            fc.Font.Bold = True
        End If
    Next colIdx

    For rIdx = 8 To totalRow - 1
        If (rIdx Mod 2) = 0 Then
            wsPivot.Range(wsPivot.Cells(rIdx, 1), wsPivot.Cells(rIdx, lastPivotCol)).Interior.Color = RGB(246, 248, 255)
        End If
    Next rIdx

    With wsPivot.Range(wsPivot.Cells(totalRow, 1), wsPivot.Cells(totalRow, lastPivotCol))
        .Font.Bold = True
        .Interior.Color = RGB(215, 220, 240)
    End With
    wsPivot.Cells(totalRow, 1).HorizontalAlignment = xlLeft
    wsPivot.Cells(totalRow, 1).IndentLevel = 1
    For rIdx = 8 To totalRow
        wsPivot.Rows(rIdx).RowHeight = 20
    Next rIdx

    wsPivot.Columns(1).ColumnWidth = 24
    For colIdx = 2 To lastPivotCol
        wsPivot.Columns(colIdx).ColumnWidth = 20
    Next colIdx

    legRow = totalRow + 2
    With wsPivot.Cells(legRow, 1)
        .Value = "Расшифровка:"
        .Font.Name = "Times New Roman"
        .Font.Size = 9
        .Font.Bold = True
        .Font.Color = RGB(50, 55, 80)
    End With
    legText(0) = "А. Устранено с просроком — нарушения устранены ОИВ, но сроки были нарушены"
    legText(1) = "Б. В работе с просроком — нарушения ещё в работе и имеют просрочку"
    legText(2) = "В. В работе без просрока — нарушения в работе, срок не нарушен"
    legText(3) = "Г. Устранено без просрока — нарушения устранены без нарушения сроков"
    legColor(0) = RGB(180, 35, 35)
    legColor(1) = RGB(190, 80, 10)
    legColor(2) = RGB(20, 90, 160)
    legColor(3) = RGB(30, 115, 55)
    For li = 0 To 3
        With wsPivot.Cells(legRow + 1 + li, 1)
            .Value = legText(li)
            .Font.Name = "Times New Roman"
            .Font.Size = 9
            .Font.Bold = True
            .Font.Color = legColor(li)
        End With
    Next li

    With wsPivot.PageSetup
        .Orientation = xlLandscape
        .FitToPagesWide = 1
        .FitToPagesTall = False
        .Zoom = False
        .LeftMargin = Application.CentimetersToPoints(0.5)
        .RightMargin = Application.CentimetersToPoints(0.5)
        .TopMargin = Application.CentimetersToPoints(0.5)
        .BottomMargin = Application.CentimetersToPoints(0.5)
    End With

    Exit Sub
MacroError:
    Application.DisplayAlerts = False
    Err.Raise Err.Number, Err.Source, "MWIS macro error: " & Err.Description
End Sub
"""

    excel = win32com.client.Dispatch('Excel.Application')
    excel.Visible = False
    excel.DisplayAlerts = False

    workbook = excel.Workbooks.Open(updated_filepath)

    vb_module = workbook.VBProject.VBComponents.Add(1)
    vb_module.CodeModule.AddFromString(vba_macro)

    try:
        excel.Application.Run("CreatePivotTable")
        print("Pivot created")
    except Exception as macro_err:
        print(f"[MWIS] Ошибка VBA макроса: {macro_err}")
        raise RuntimeError(f"VBA CreatePivotTable failed: {macro_err}") from macro_err

    workbook.Save()

    pdf_file_name = f"МЖИ {date1} - {date2} на {gen_date_str} {gen_time}.pdf"
    pdf_path = os.path.join(os.path.dirname(updated_filepath), pdf_file_name)

    wsPivot = workbook.Worksheets(1)
    wsPivot.PageSetup.FitToPagesWide = 1
    wsPivot.PageSetup.FitToPagesTall = False
    wsPivot.PageSetup.Zoom = False
    wsPivot.PageSetup.LeftMargin = excel.Application.CentimetersToPoints(0.5)
    wsPivot.PageSetup.RightMargin = excel.Application.CentimetersToPoints(0.5)
    wsPivot.PageSetup.TopMargin = excel.Application.CentimetersToPoints(0.5)
    wsPivot.PageSetup.BottomMargin = excel.Application.CentimetersToPoints(0.5)

    workbook.Save()
    try:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
        print(f"Сохранение PDF в {pdf_path}...")
        wsPivot.ExportAsFixedFormat(0, pdf_path)
        print(f"PDF успешно создан: {pdf_path}")
    except Exception as e:
        print(f"Ошибка при сохранении PDF: {e}")

    workbook.Worksheets(2).Cells.EntireColumn.AutoFit()
    workbook.Save()
    workbook.Close()
    excel.Quit()

    static_directory = os.path.join(BASE_DIR, 'MWIS')
    if not os.path.exists(static_directory):
        os.makedirs(static_directory)

    excel_filename = os.path.basename(updated_filepath)
    excel_dest = os.path.join(static_directory, excel_filename)
    if os.path.exists(excel_dest):
        os.remove(excel_dest)
    shutil.move(updated_filepath, static_directory)
    updated_filepath = excel_dest
    print(f"Файл Excel перемещен в: {updated_filepath}")

    pdf_filename = os.path.basename(pdf_path)
    pdf_dest = os.path.join(static_directory, pdf_filename)
    if os.path.exists(pdf_dest):
        os.remove(pdf_dest)
    shutil.move(pdf_path, static_directory)
    pdf_path = pdf_dest
    print(f"Файл PDF перемещен в: {pdf_path}")

    return updated_filepath


def mwis():
    if _running['mwis']:
        print("[mwis] Пропуск: предыдущий запуск ещё выполняется")
        return
    _running['mwis'] = True
    _coinit = False
    try:
        if not parcing_mji():
            _record_failure('mwis', 'Парсер не смог загрузить данные после всех попыток')
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

        backup_path = filepath + '.backup'
        try:
            shutil.copy2(filepath, backup_path)
            print(f"✓ Создана резервная копия: {backup_path}")
        except Exception as e:
            print(f"⚠ Не удалось создать резервную копию: {e}")

        excel_filepath = safe_excel_operation(process_mji, filepath, timeout_seconds=600)

        mwis_dir = os.path.join(BASE_DIR, 'MWIS')
        mwis_files = os.listdir(mwis_dir)
        mwis_pdf_files = [f for f in mwis_files if f.lower().endswith('.pdf')]
        mwis_pdf_files.sort(key=lambda x: os.path.getmtime(os.path.join(mwis_dir, x)))
        mwis_pdf_path = os.path.join(mwis_dir, mwis_pdf_files[-1]) if mwis_pdf_files else None

        print(f"🔍 [MWIS] Excel файл: {excel_filepath}")
        print(f"🔍 [MWIS] PDF файл: {mwis_pdf_path}")

        files_to_upload = []
        if excel_filepath and os.path.exists(excel_filepath):
            files_to_upload.append(excel_filepath)
        else:
            print(f"⚠ Excel файл не найден: {excel_filepath}")

        if mwis_pdf_path and os.path.exists(mwis_pdf_path):
            files_to_upload.append(mwis_pdf_path)

        if files_to_upload and upload_reports_to_server('MWIS', files_to_upload):
            print("✔ Отчёты MWIS загружены на сервер")
        else:
            print("❌ Нет файлов для загрузки или ошибка загрузки")

        keep_latest_files(mwis_dir, 'MWIS')
        clean_parcing_folder()
        print("Процесс завершен успешно!")
        _record_success('mwis')
    except Exception as e:
        import traceback
        print(f"Ошибка в mwis: {e}")
        traceback.print_exc()
        _record_failure('mwis', str(e))
    finally:
        if _coinit:
            pythoncom.CoUninitialize()
        _running['mwis'] = False
