import sys
import logging
import threading

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .utils.limiter import limiter

sys.stdout.reconfigure(line_buffering=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logging.getLogger('uvicorn').setLevel(logging.INFO)
logging.getLogger('uvicorn.access').setLevel(logging.INFO)

app = FastAPI(title='web_UVAO API', version='2.0.0')

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['https://analytics-uvao.ru', 'https://www.analytics-uvao.ru'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Подключаем все роутеры
from .routers.auth import router as auth_router
from .routers.reports import router as reports_router
from .routers.statistics import router as statistics_router
from .routers.overdue import router as overdue_router
from .routers.admin import router as admin_router
from .routers.ng_overdue import router as ng_overdue_router

app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(statistics_router)
app.include_router(overdue_router)
app.include_router(admin_router)
app.include_router(ng_overdue_router)


def run_app():
    uvicorn.run(app, host='0.0.0.0', port=5000)


if __name__ == '__main__':
    from .scheduler import run_scheduled_tasks

    # Запуск планировщика задач в отдельном потоке
    scheduler_thread = threading.Thread(target=run_scheduled_tasks)
    scheduler_thread.daemon = True
    scheduler_thread.start()

    run_app()