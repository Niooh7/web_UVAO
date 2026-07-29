import time
import pandas as pd
import os
from datetime import datetime, timedelta
from openpyxl import load_workbook
from openpyxl.styles import Border, Side, Alignment, Font, PatternFill
from openpyxl.formatting.rule import CellIsRule
import win32com.client
import numpy as np
import pandas as pd

# Путь к файлу Excel

def process_file():
    files = os.listdir(download_dir)
    files.sort(key=lambda x: os.path.getmtime(os.path.join(download_dir, x)))
    # Выбираем все просроки в отчетном периоде
    latest_downloaded_file = files[-1]
    file_path1 = os.path.join(download_dir, latest_downloaded_file)
    print(file_path1)
    prosrokcurr = pd.read_excel(file_path1, sheet_name=sheet1)
    prosrok_curr = prosrokcurr
    kpbp_curr = pd.read_excel(file_path1, sheet_name=sheet2)
    all_prosrok_new_curr =  pd.read_excel(file_path1, sheet_name=sheet3)
    #все проcрочки в базисном периоде
    all_prosrok_curr_downloaded_file = files[-2]
    file_path2 = os.path.join(download_dir, all_prosrok_curr_downloaded_file)
    print(file_path2)
    prosrokbase = pd.read_excel(file_path2, sheet_name=sheet1)
    prosrok_base = prosrokbase
    kpbp_base = pd.read_excel(file_path2, sheet_name=sheet2)
    all_prosrok_new_base = pd.read_excel(file_path2, sheet_name=sheet3)
    return prosrok_curr, prosrok_base, kpbp_curr, kpbp_base, all_prosrok_new_curr, all_prosrok_new_base
def main_NEW(all_prosrok_new_curr, all_prosrok_new_base):
    prosrok_base = all_prosrok_new_base
    prosrok_curr = all_prosrok_new_curr
    dfbase = pd.pivot_table(prosrok_base, values="ID нарушения", index="Район", aggfunc="count", margins=True)
    dfbase = dfbase.rename(
        columns={'ID нарушения': 'Базисный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый', "АВД ЮВАО"]
    ).fillna(int(0))
    dfbase = itog0.join(dfbase, how='left')
    dfbase = dfbase.fillna(int(0))
    dfbase = dfbase.reset_index()
    dfbase.rename(columns={'index': 'Район'}, inplace=True)
    # по району в отчетном пероде
    dfcurr = pd.pivot_table(prosrok_curr, values="ID нарушения", index="Район", aggfunc="count", margins=True)
    dfcurr = dfcurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый', "АВД ЮВАО"]
    ).fillna(int(0))
    dfcurr = itog0.join(dfcurr, how='left')
    dfcurr = dfcurr.fillna(int(0))
    dfcurr = dfcurr.reset_index()
    dfcurr.rename(columns={'index': 'Район'}, inplace=True)

    # объеденяем
    dfmain = pd.merge(dfbase, dfcurr, how="left")
    print(dfmain)
    # в разрезе систем источников
    dfobase = pd.pivot_table(prosrok_base, values="ID нарушения", index="Система-источник", aggfunc="count")
    dfobase = dfobase.rename(
        columns={'ID нарушения': 'Базисный период'})
    dfobase = dfobase.reset_index()
    dfobase.rename(columns={'index': 'Система-источник'}, inplace=True)

    # тоже самое по отчетному
    dfocurr = pd.pivot_table(prosrok_curr, values="ID нарушения", index="Система-источник", aggfunc="count")
    dfocurr = dfocurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    dfocurr = dfocurr.reset_index()
    dfocurr.rename(columns={'index': 'Система-источник'}, inplace=True)

    # объеденяем
    dfomain = pd.merge(dfobase, dfocurr, how="outer")
    print(dfomain)

    def odh_problems(prosrok_curr):
        dfcurr = pd.pivot_table(prosrok_curr, values="ID нарушения", index="Район", columns="Проблема", aggfunc="count")
        dfcurr = dfcurr.rename(
            columns={'ID нарушения': 'Отчетный период'})
        itog0 = pd.DataFrame(
            index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
                   'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый', "АВД ЮВАО"]
        ).fillna(int(0))
        dfcurr = itog0.join(dfcurr, how='left')
        dfcurr = dfcurr.fillna(int(0))
        dfcsum = dfcurr.sum()
        mask1 = dfcsum.sort_values(ascending=False).index
        dfcsort = dfcurr[mask1]
        dfwithproblem = dfcsort.iloc[:, :6]
        dfwithproblem = dfwithproblem.reset_index()
        dfwithproblem.rename(columns={'index': 'Район'}, inplace=True)
        print(dfwithproblem)
        return dfwithproblem

    dfwithproblem = odh_problems(prosrok_curr)
    DFitof = pd.merge(dfmain, dfwithproblem, how="left")
    return DFitof, dfomain
def main4(object, prosrok_curr, prosrok_base):

    prosrok_base = prosrok_base[prosrok_base["Объект контроля"] == object]
    prosrok_curr = prosrok_curr[prosrok_curr["Объект контроля"] == object]
    #в общем по району
    dfbase = pd.pivot_table(prosrok_base, values = "ID нарушения", index = "Район", aggfunc = "count", margins= True)
    dfbase = dfbase.rename(
        columns={'ID нарушения': 'Базисный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый', "АВД ЮВАО"]
    ).fillna(int(0))
    dfbase = itog0.join(dfbase, how='left')
    dfbase = dfbase.fillna(int(0))
    dfbase = dfbase.reset_index()
    dfbase.rename(columns={'index': 'Район'}, inplace=True)
    #по району в отчетном пероде
    dfcurr = pd.pivot_table(prosrok_curr, values="ID нарушения", index="Район", aggfunc= "count", margins=True)
    dfcurr = dfcurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый', "АВД ЮВАО"]
    ).fillna(int(0))
    dfcurr = itog0.join(dfcurr, how='left')
    dfcurr = dfcurr.fillna(int(0))
    dfcurr = dfcurr.reset_index()
    dfcurr.rename(columns={'index': 'Район'}, inplace=True)

    #объеденяем
    dfmain = pd.merge(dfbase, dfcurr, how="left")
    print(dfmain)
    #в разрезе систем источников
    dfobase = pd.pivot_table(prosrok_base, values="ID нарушения", index="Система-источник", aggfunc="count")
    dfobase = dfobase.rename(
        columns={'ID нарушения': 'Базисный период'})
    dfobase = dfobase.reset_index()
    dfobase.rename(columns={'index': 'Система-источник'}, inplace=True)

    #тоже самое по отчетному
    dfocurr = pd.pivot_table(prosrok_curr, values="ID нарушения", index="Система-источник", aggfunc="count")
    dfocurr = dfocurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    dfocurr = dfocurr.reset_index()
    dfocurr.rename(columns={'index': 'Система-источник'}, inplace=True)

    #объеденяем
    dfomain = pd.merge(dfobase, dfocurr, how="outer")
    print(dfomain)


    def odh_problems(prosrok_curr):
        dfcurr = pd.pivot_table(prosrok_curr, values="ID нарушения", index="Район", columns="Проблема", aggfunc="count")
        dfcurr = dfcurr.rename(
            columns={'ID нарушения': 'Отчетный период'})
        itog0 = pd.DataFrame(
            index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
                   'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый', "АВД ЮВАО"]
        ).fillna(int(0))
        dfcurr = itog0.join(dfcurr, how='left')
        dfcurr = dfcurr.fillna(int(0))
        dfcsum = dfcurr.sum()
        mask1 = dfcsum.sort_values(ascending=False).index
        dfcsort = dfcurr[mask1]
        dfwithproblem = dfcsort.iloc[:, :6]
        dfwithproblem = dfwithproblem.reset_index()
        dfwithproblem.rename(columns={'index': 'Район'}, inplace=True)
        print(dfwithproblem)
        return dfwithproblem
    dfwithproblem = odh_problems(prosrok_curr)
    DFitof = pd.merge(dfmain, dfwithproblem, how="left")
    #проверяем есть ли АВД ЮВАО в дт, если да, то его выводим
    if (prosrok_curr["Объект контроля"] == "ДТ").any():
        avduvao = prosrok_curr[prosrok_curr["Район"] == "АВД ЮВАО"]
        print(avduvao)
        return DFitof, dfomain, avduvao
    return DFitof, dfomain
def kp_bp(kpbp_curr, kpbp_base):
    dfbase = pd.pivot_table(kpbp_base, values="ID нарушения", index="Район", aggfunc="count", margins=True)
    dfbase = dfbase.rename(
        columns={'ID нарушения': 'Базисный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый']
    ).fillna(int(0))
    dfbase = itog0.join(dfbase, how='left')
    dfbase = dfbase.fillna(int(0))
    dfbase = dfbase.reset_index()
    dfbase.rename(columns={'index': 'Район'}, inplace=True)

    dfcurr = pd.pivot_table(kpbp_curr, values="ID нарушения", index="Район", aggfunc="count", margins=True)
    dfcurr = dfcurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый']
    ).fillna(int(0))
    dfcurr = itog0.join(dfcurr, how='left')
    dfcurr = dfcurr.fillna(int(0))
    dfcurr = dfcurr.reset_index()
    dfcurr.rename(columns={'index': 'Район'}, inplace=True)
    dfmain = pd.merge(dfbase, dfcurr, how="left")

    dfcurr = pd.pivot_table(kpbp_curr, values="ID нарушения", index="Район", columns="Проблема", aggfunc="count")
    dfcurr = dfcurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    itog0 = pd.DataFrame(
        index=['Выхино-Жулебино', 'Капотня', "Кузьминки", "Лефортово", 'Люблино', 'Марьино',
               'Некрасовка', 'Нижегородский', 'Печатники', 'Рязанский', 'Текстильщики', 'Южнопортовый']
    ).fillna(int(0))
    dfcurr = itog0.join(dfcurr, how='left')
    dfcurr = dfcurr.fillna(int(0))
    dfcsum = dfcurr.sum()
    mask1 = dfcsum.sort_values(ascending=False).index
    dfcsort = dfcurr[mask1]
    dfcsort = dfcsort.reset_index()
    dfcsort.rename(columns={'index': 'Район'}, inplace=True)
    print(dfcsort)
    dfmain = pd.merge(dfmain, dfcsort, how="left")

    # в разрезе систем источников
    dfobase = pd.pivot_table(kpbp_base, values="ID нарушения", index="Система-источник", aggfunc="count")
    dfobase = dfobase.rename(
        columns={'ID нарушения': 'Базисный период'})
    dfobase = dfobase.reset_index()
    dfobase.rename(columns={'index': 'Система-источник'}, inplace=True)

    # тоже самое по отчетному
    dfocurr = pd.pivot_table(kpbp_curr, values="ID нарушения", index="Система-источник", aggfunc="count")
    dfocurr = dfocurr.rename(
        columns={'ID нарушения': 'Отчетный период'})
    dfocurr = dfocurr.reset_index()
    dfocurr.rename(columns={'index': 'Система-источник'}, inplace=True)
    # объеденяем
    dfomain = pd.merge(dfobase, dfocurr, how="outer")



    return dfmain, dfomain

# Чтение данных из Excel
download_dir = "D:/Downloads"
sheet1 = "Просроки"
sheet2 = "КП_БП"# Укажите имя листа
sheet3 = "Новые просроки"

prosrok_curr, prosrok_base, kpbp_curr, kpbp_base, all_prosrok_new_curr, all_prosrok_new_base = process_file()

dfmainnew_prosrok, dfonew_prosrok = main_NEW(all_prosrok_new_curr, all_prosrok_new_base)

dfmainodh, dfoodh = main4("ОДХ", prosrok_curr, prosrok_base)
dfmainmkd, dfomkd = main4("МКД",prosrok_curr, prosrok_base)
dfmainparki, dfoparki = main4("Парки",prosrok_curr, prosrok_base)
dfmaindt, dfodt, avduvao = main4("ДТ",prosrok_curr, prosrok_base)

dfkpbp, dfomainkpbp = kp_bp(kpbp_curr, kpbp_base)

file_path = f'СВОД ММ сырой {datetime.now().strftime("%d.%m")}.xlsx'

# Используем ExcelWriter для записи в файл
with pd.ExcelWriter(file_path, engine='openpyxl') as writer:

    dfmainnew_prosrok.to_excel(writer, sheet_name='1.Новые просроки', index=False, startrow=1, startcol=1)  # Сохраняем df1 на лист "Лист1"
    dfonew_prosrok.to_excel(writer, sheet_name='1.Новые просроки', index=False, startrow=16, startcol=1)  # Сохраняем df2 на лист "Лист2"

    dfmainodh.to_excel(writer, sheet_name='2.ОДХ', index = False, startrow = 1, startcol = 1)  # Сохраняем df1 на лист "Лист1"
    dfoodh.to_excel(writer, sheet_name='2.ОДХ', index = False ,startrow = 16, startcol= 1)  # Сохраняем df2 на лист "Лист2"

    dfmainmkd.to_excel(writer, sheet_name='3.МКД',index = False,  startrow=1, startcol=1)  # Сохраняем df1 на лист "Лист1"
    dfomkd.to_excel(writer, sheet_name='3.МКД', index = False , startrow=16, startcol=1)  # Сохраняем df2 на лист "Лист2"
    
    dfmainparki.to_excel(writer, sheet_name='4.Парки', index = False, startrow=1, startcol=1)  # Сохраняем df1 на лист "Лист1"
    dfoparki.to_excel(writer, sheet_name='4.Парки', index = False, startrow=16, startcol=1)  # Сохраняем df2 на лист "Лист2"
    
    dfmaindt.to_excel(writer, sheet_name='5.ДТ', index = False, startrow=1, startcol=1)  # Сохраняем df1 на лист "Лист1"
    dfodt.to_excel(writer, sheet_name='5.ДТ', index = False, startrow=16, startcol=1)  # Сохраняем df2 на лист "Лист2"
    avduvao.to_excel(writer, sheet_name='5.ДТ', index=True, startrow=25, startcol=1)

    dfkpbp.to_excel(writer, sheet_name='6.КПБП', index=False, startrow=1, startcol=1)
    dfomainkpbp.to_excel(writer, sheet_name='6.КПБП',index = False, startrow=16, startcol=1)
