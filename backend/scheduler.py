import schedule
import time

from .parsers.mm import mm
from .parsers.ng import ng
from .parsers.mwi import mwi
from .parsers.mwis import mwis
from .parsers.tsafap import tsafap
from .parsers.oati import oati
from .parsers.transfers import update_transfer_statistics


def run_scheduled_tasks():
    """Функция для выполнения задач по расписанию"""
    '''Настройка выполнения задач каждый день для Ответов в работе и ЛК Префекта'''
    prefect_schedule = [
        "07:55", "08:55", "09:55", "10:55", "11:55",
        "12:55", "13:55", "14:55", "15:55", "16:55",
        "17:55", "18:55", "19:55", "20:55", "21:55"
    ]
    for schedule_time in prefect_schedule:
        schedule.every().day.at(schedule_time).do(ng, scheduled_time=schedule_time)

    '''Настройка выполнения задач каждый день для Монитора в работе'''
    monitor_schedule = [
        "07:50", "08:50", "09:50", "10:50", "11:50",
        "12:50", "13:50", "14:50", "15:50", "16:50",
        "17:50", "18:50", "19:50", "20:50", "21:50"
    ]
    for schedule_time in monitor_schedule:
        schedule.every().day.at(schedule_time).do(mm, scheduled_time=schedule_time)

    '''Настройка выполнения задач каждый день для СВОД МЖИ'''
    mwi_schedule = ["10:15", "12:15", "14:15", "16:15", "18:15", "20:15"]
    for schedule_time in mwi_schedule:
        schedule.every().day.at(schedule_time).do(mwi)

    '''Настройка выполнения задач каждый день для Статистики МЖИ'''
    mwis_schedule = ["08:29"]
    for schedule_time in mwis_schedule:
        schedule.every().day.at(schedule_time).do(mwis)

    '''Настройка выполнения задач каждый день для нарушений ЦАФАП'''
    tsafap_schedule = ["09:29"]
    for schedule_time in tsafap_schedule:
        schedule.every().day.at(schedule_time).do(tsafap)

    '''Настройка выполнения задач каждый день для нарушений ОАТИ'''
    oati_schedule = ["08:59"]
    for schedule_time in oati_schedule:
        schedule.every().day.at(schedule_time).do(oati)

    '''Настройка выполнения задачи обновления статистики переносов каждое воскресенье в 23:20'''
    schedule.every().sunday.at("23:20").do(update_transfer_statistics)

    while True:
        schedule.run_pending()
        time.sleep(10)
