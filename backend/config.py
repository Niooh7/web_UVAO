import os
import threading
from dotenv import load_dotenv

load_dotenv()

# ── Project paths ─────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BASE_DIR      = os.path.join(PROJECT_ROOT, 'public')
DATABASE_PATH = os.path.join(PROJECT_ROOT, 'Databases', 'BD_work')
DB_DELAYS_PATH = os.path.join(PROJECT_ROOT, 'Databases', 'requests.db')
home_dir  = os.path.expanduser('~')
directory = os.path.join(home_dir, 'Downloads')

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET_KEY      = os.environ['JWT_SECRET_KEY']
JWT_ALGORITHM       = 'HS256'
JWT_EXPIRE_MINUTES  = 60 * 8  # 8 hours

# ── Parser credentials ────────────────────────────────────────────────────────
login_NG       = os.environ['LOGIN_NG']
password_NG    = os.environ['PASSWORD_NG']
login_MM       = os.environ['LOGIN_MM']
password_MM    = os.environ['PASSWORD_MM']
login_TSAFAP   = os.environ['LOGIN_TSAFAP']
password_TSAFAP = os.environ['PASSWORD_TSAFAP']

# ── TDM / Telegram ────────────────────────────────────────────────────────────А
TOKEN           = os.environ['TDM_TOKEN']
REPORT_GROUP_ID = int(os.environ['TDM_REPORT_GROUP_ID'])
REPORT_GROUP_ID_2 = int(os.environ['TDM_REPORT_GROUP_ID_2'])
rest            = os.environ['TDM_REST_URL']
FILE_UPLOAD_URL = os.environ['TDM_FILE_UPLOAD_URL']

# ── Server / SCP ──────────────────────────────────────────────────────────────
REPORTS_CONFIG = {
    'server_ip':          os.environ['SERVER_IP'],
    'server_user':        os.environ['SERVER_USER'],
    'ssh_key':            os.path.join(home_dir, '.ssh', 'id_ed25519'),
    'remote_reports_path': os.environ['REMOTE_REPORTS_PATH'],
}

# ── Admin logins ──────────────────────────────────────────────────────────────
ADMIN_LOGINS = [
    'Admin1',
]

# ── Non-working dates ─────────────────────────────────────────────────────────
excluded_dates = [
    "26.09.2026", "27.09.2026", "03.10.2026", "04.10.2026",
    "10.10.2026", "11.10.2026", "17.10.2026", "18.10.2026", "24.10.2026", "25.10.2026",
    "31.10.2026", "01.11.2026", "07.11.2026", "08.11.2026",
    "14.11.2026", "15.11.2026", "21.11.2026", "22.11.2026", "28.11.2026", "29.11.2026",
    "05.12.2026", "06.12.2026", "12.12.2026", "13.12.2026", "19.12.2026", "20.12.2026",
    "26.12.2026", "27.12.2026", "31.12.2026",
]

# ── Parser run-lock ───────────────────────────────────────────────────────────
_REPORT_KEYS = ('mm', 'ng', 'mwi', 'mwis', 'tsafap', 'oati')
_running: dict = {k: False for k in _REPORT_KEYS}

# ── Report-status cache (TTL 30 s) ────────────────────────────────────────────
_status_cache: dict = {'data': None, 'ts': 0.0}
