import os
import shutil
import traceback

import pandas as pd
import pythoncom
import win32com.client
from datetime import datetime, timedelta

from ..config import BASE_DIR, directory, _running
from ..utils.helpers import upload_reports_to_server, keep_latest_files, clean_parcing_folder
from ..utils.status import _record_success, _record_failure
from .tsafap import parcing_tsafap


def OATI_process_data_and_create_pivot(input_file, output_dir=None):
    yesterday = datetime.now() - timedelta(days=1)
    date_str = yesterday.strftime("%d.%m.%Y")

    now = datetime.now()
    date = now.strftime("%d.%m.%Y")
    time_str = now.strftime("%H-%M")

    base_filename = f"Нарушения ОАТИ за {date_str} на {date} {time_str}"

    if output_dir is None:
        output_dir = os.path.join(BASE_DIR, 'OATI')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    excel_output_path = os.path.join(output_dir, f"{base_filename}.xlsx")
    pdf_output_path = os.path.join(output_dir, f"{base_filename}.pdf")
    temp_file = os.path.join(output_dir, '_temp_data.xlsx')

    try:
        print(f"🔍 [OATI] Обработка данных из: {input_file}")

        df = pd.read_excel(input_file, sheet_name="Детализированный", header=4)

        print(f"📊 Столбцы: {list(df.columns)}")
        print(f"📊 Строк до фильтрации: {len(df)}")

        df = df[df["Контрольный орган"] == "ОАТИ"]
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

        print("🔍 [OATI] Создание сводной таблицы...")
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
    wsPivot.Range("A1") = "Сводка нарушений ОАТИ от {date_str}"
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
        print(f"✅ [OATI] Excel сохранен: {excel_output_path}")

        print("🔍 [OATI] Создание PDF...")
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
        print(f"✅ [OATI] PDF создан: {pdf_output_path}")

        workbook.Close(SaveChanges=False)
        excel.Quit()

        if os.path.exists(temp_file):
            os.remove(temp_file)

        print(f"✅ [OATI] Обработка завершена успешно!")
        return excel_output_path, pdf_output_path

    except Exception as e:
        print(f"❌ [OATI] Ошибка в process_data_and_create_pivot: {e}")
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


def oati():
    if _running['oati']:
        print("[oati] Пропуск: предыдущий запуск ещё выполняется")
        return
    _running['oati'] = True
    _coinit = False
    try:
        if not parcing_tsafap():
            _record_failure('oati', 'Парсер не смог загрузить данные')
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

        print("🔍 [OATI] Обработка данных...")
        excel_path, pdf_path = OATI_process_data_and_create_pivot(filepath)

        if not excel_path:
            print("❌ [OATI] Ошибка обработки данных - Excel файл не создан")
            return

        print(f"✅ [OATI] Excel файл создан: {excel_path}")
        print(f"✅ [OATI] PDF файл создан: {pdf_path}")

        print("🔍 [OATI] Загрузка отчётов на сервер...")
        files_to_upload = [excel_path]
        if pdf_path and os.path.exists(pdf_path):
            files_to_upload.append(pdf_path)

        if upload_reports_to_server('OATI', files_to_upload):
            print("✔ [OATI] Отчёты загружены на сервер")
        else:
            print("⚠ [OATI] Не удалось загрузить отчёты на сервер")

        oati_dir = os.path.join(BASE_DIR, 'OATI')
        keep_latest_files(oati_dir, 'OATI')
        clean_parcing_folder()
        print("✅ [OATI] Процесс завершен успешно!")
        _record_success('oati')

    except Exception as e:
        print(f"❌ [OATI] Ошибка в oati: {e}")
        traceback.print_exc()
        _record_failure('oati', str(e))
    finally:
        if _coinit:
            pythoncom.CoUninitialize()
        _running['oati'] = False
