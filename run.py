import sys
import os
import threading

# Корень проекта — папка с этим файлом
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from backend.main import app
from backend.scheduler import run_scheduled_tasks

if __name__ == '__main__':
    scheduler_thread = threading.Thread(target=run_scheduled_tasks, daemon=True)
    scheduler_thread.start()
    print("✅ [Scheduler] Поток планировщика запущен")

    uvicorn.run(app, host='0.0.0.0', port=5000)
