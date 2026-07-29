import os
import json
import threading
from datetime import datetime
from webdriver_manager.chrome import ChromeDriverManager

from ..config import PROJECT_ROOT, _REPORT_KEYS, _status_cache

FAILURE_STATE_FILE = os.path.join(PROJECT_ROOT, 'failure_state.json')

# Chrome driver — кэшируем путь один раз, избегаем HTTP-запрос при каждом старте
_CHROMEDRIVER_PATH: str = ''
_CHROMEDRIVER_LOCK = threading.Lock()


def _load_failure_state() -> dict:
    try:
        with open(FAILURE_STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {k: {'consecutive_failures': 0, 'last_success': None, 'last_error': None, 'is_degraded': False}
                for k in _REPORT_KEYS}


def _save_failure_state(state: dict):
    try:
        with open(FAILURE_STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[FailureState] Ошибка сохранения: {e}")


def _record_success(report_key: str):
    state = _load_failure_state()
    state[report_key] = {
        'consecutive_failures': 0,
        'last_success': datetime.now().strftime('%d.%m.%Y %H:%M'),
        'last_error': None,
        'is_degraded': False,
    }
    _save_failure_state(state)
    _status_cache['ts'] = 0.0
    print(f"[FailureState] {report_key}: успешно выполнено")


def _record_failure(report_key: str, error_msg: str):
    state = _load_failure_state()
    prev = state.get(report_key, {})
    count = prev.get('consecutive_failures', 0) + 1
    state[report_key] = {
        'consecutive_failures': count,
        'last_success': prev.get('last_success'),
        'last_error': f"{datetime.now().strftime('%d.%m.%Y %H:%M')} — {str(error_msg)[:300]}",
        'is_degraded': True,
    }
    _save_failure_state(state)
    _status_cache['ts'] = 0.0
    print(f"[FailureState] {report_key}: сбой #{count} (деградировано)")


def _get_chromedriver() -> str:
    """Возвращает путь к chromedriver, кэширует после первого вызова."""
    global _CHROMEDRIVER_PATH
    if _CHROMEDRIVER_PATH:
        return _CHROMEDRIVER_PATH
    with _CHROMEDRIVER_LOCK:
        if not _CHROMEDRIVER_PATH:
            chrome_install = ChromeDriverManager().install()
            _CHROMEDRIVER_PATH = os.path.join(os.path.dirname(chrome_install), "chromedriver.exe")
            print(f"[ChromeDriver] Кэшировано: {_CHROMEDRIVER_PATH}")
    return _CHROMEDRIVER_PATH
