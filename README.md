# web_UVAO

### Created by tel9 & GNAVA4

Система аналитики для Префектуры ЮВАО г. Москвы. Автоматически собирает данные с порталов (Монитор Мэра, Наш Город, МЖИ, ОАТИ, ЦАФАП), обрабатывает их через Excel/Word, публикует отчёты в формате PDF/XLSX и предоставляет доступ через защищённый веб-интерфейс.

---

## Стек технологий

| Слой              | Технология                                              |
|-------------------|---------------------------------------------------------|
| Frontend          | React 18, TypeScript, Vite, Tailwind CSS, Recharts      |
| Backend           | Python 3.11+, FastAPI, Uvicorn                          |
| Auth              | JWT (python-jose HS256), bcrypt (passlib)               |
| Rate limiting     | slowapi                                                 |
| Базы данных       | SQLite (`BD_work`, `requests.db`)                       |
| Excel/Word        | win32com (COM-автоматизация), openpyxl, pandas          |
| Браузерная авт.   | Selenium 4, webdriver-manager, ChromeDriver             |
| Планировщик       | schedule + threading (фоновые потоки)                   |
| Сетевой туннель   | WireGuard VPN (Windows-машина ↔ сервер)                 |
| Деплой            | SSH + SCP (paramiko), nginx, Let's Encrypt              |
| Мессенджер        | TDM (корпоративный мессенджер Москвы)                   |

---

## Структура проекта

```
web_UVAO/
├── run.py                   Точка входа: запускает FastAPI + планировщик
├── deploy_full.py           Сборка React и деплой frontend на сервер
├── deploy_full.bat          Запуск деплоя из Windows
├── .env                     Секреты (не попадает в git)
│
├── backend/
│   ├── main.py              FastAPI app, роутеры, slowapi middleware
│   ├── config.py            Все константы и пути — читаются из .env
│   ├── scheduler.py         Планировщик: запускает парсеры по расписанию
│   ├── requirements.txt
│   │
│   ├── parsers/             Парсеры — скрапят порталы, генерируют Excel/PDF
│   │   ├── mm.py            Монитор Мэра
│   │   ├── ng.py            Наш Город
│   │   ├── mwi.py           СВОД МЖИ
│   │   ├── mwis.py          Статистика МЖИ
│   │   ├── tsafap.py        Нарушения ЦАФАП
│   │   ├── oati.py          Нарушения ОАТИ (использует парсер ЦАФАП)
│   │   └── transfers.py     Статистика переносов
│   │
│   ├── routers/             HTTP-маршруты
│   │   ├── auth.py          POST /api/auth/login → JWT
│   │   ├── reports.py       Статус, архив, файлы, раздача отчётов
│   │   ├── statistics.py    Переносы, графики, диапазон дат
│   │   ├── overdue.py       Последний визит, удаление просрочек (MM_prosrok)
│   │   ├── ng_overdue.py    Дашборд НГ — данные и Excel-экспорт (NG_prosrok)
│   │   ├── admin.py         CRUD пользователей, запуск отчётов
│   │   └── schemas.py       Pydantic-модели запросов
│   │
│   ├── utils/
│   │   ├── auth.py          bcrypt, JWT, Depends(get_current_user/admin)
│   │   ├── helpers.py       Excel, SCP-загрузка, Telegram, ChromeDriver
│   │   ├── limiter.py       slowapi Limiter (rate limiting)
│   │   └── status.py        Состояние и статус генерации отчётов
│   │
│   ├── public/              Сгенерированные отчёты (MM, NG, MWI, MWIS, Pref, OATI, TSAFAP)
│   └── Databases/           SQLite базы данных
│
└── frontend/
    ├── src/
    │   ├── components/      React-компоненты (Dashboard, AdminPanel, ReportViewer и др.)
    │   │   └── Analytics/   Аналитические дашборды (NG, MM, переносы, архив)
    │   ├── utils/api.ts     Axios-инстанс с Bearer-токеном + fetchWithAuth
    │   ├── types.ts         TypeScript-типы
    │   └── App.tsx          Роутинг, управление сессией
    ├── public/
    │   ├── baza/            Файлы базы знаний (PDF, docx, xlsx)
    │   └── files/           Скрипты ответов (xlsx)
    └── dist/                Сборка (генерируется при npm run build)
```

---

## Безопасность

| Механизм               | Реализация                                                         |
|------------------------|--------------------------------------------------------------------|
| Аутентификация         | JWT HS256, срок действия 8 часов                                   |
| Хэширование паролей    | bcrypt; автоматическая миграция со старых SHA-256 хэшей при входе  |
| Rate limiting          | 10 запросов/мин на `/api/auth/login` (slowapi)                     |
| Защита от timing-атак  | `hmac.compare_digest` при сравнении устаревших SHA-256 хэшей       |
| Авторизация            | `Depends(get_current_user)` / `Depends(get_current_admin)` на всех защищённых маршрутах |
| Пароли в ответах       | Хэши паролей не возвращаются ни в одном API-ответе                 |
| 500-ошибки             | Клиент получает только "Внутренняя ошибка сервера", детали — в логах |
| Секреты                | Все ключи, токены и пароли в `.env`, не попадают в git             |

---

## Производственная архитектура

```
Браузер
  └── nginx (analytics-uvao.ru, HTTPS/443)
       ├── /              → /var/www/dist     (React SPA)
       ├── /reports/*     → /var/www/reports/ (отчёты, статические файлы)
       └── /api/*         → 10.10.10.2:5000  (FastAPI через WireGuard VPN)
                                                      |
                                    WireGuard-туннель (UDP 51820)
                                                      |
                                             Windows-машина (10.10.10.2)
                                             ├── FastAPI (порт 5000)
                                             └── Планировщик парсеров
```

Windows-машина и сервер соединены постоянным WireGuard-туннелем (приватная сеть `10.10.10.0/24`) — nginx проксирует `/api/*` напрямую на приватный IP Windows-машины, без port-forwarding и лишних промежуточных процессов. Интерфейс `wg0` на сервере поднимается автоматически при загрузке (`systemctl enable wg-quick@wg0`); на Windows тоннель нужно аналогично добавить в автозагрузку через приложение WireGuard.

Парсеры запускаются на Windows (требуют Excel/Word + Selenium). После генерации файлы копируются по SCP в `/var/www/reports/` на сервере.

---

## Дашборд НГ

Аналитическая страница сообщений портала «Наш Город» — на уровне отдельных заявок, с автоматическим трекингом статуса, фильтрацией по периоду выгрузки, интерактивным графиком и Excel-экспортом. Доступен только пользователям с `duty = 'Префектура'`.

### Источник данных

Каждый запуск `ng()` (раз в час) вызывает `_sync_ng_prosrok()` в [`backend/parsers/ng.py`](backend/parsers/ng.py), которая построчно синхронизирует финальную таблицу «Ответы в работе» в SQLite-таблицу `NG_prosrok` (БД `BD_work`).

Строки идентифицируются по `Номер заявки` — UPSERT (`INSERT ... ON CONFLICT(ID) DO UPDATE`), дублей быть не может.

### Правило 8 рабочих дней

Столбец «День» (`1 день` … `8 день` / `Просрок`) вычисляется напрямую из переменных `day_8…day_5, date4…date1`, которые парсер уже считает для сводных Excel-листов с учётом `excluded_dates` из [`backend/config.py`](backend/config.py). Это гарантирует полное совпадение значений в дашборде и в Excel-отчёте.

### Трекинг статуса

При каждой синхронизации:
- сообщение есть в текущей выгрузке → `Status = В работе`, `ExportDate` обновляется до текущего момента;
- сообщение было в БД, но отсутствует в текущей выгрузке → `Status = Устранено`, `ExportDate` замораживается на дате последней активной выгрузки (запись не удаляется).

Если сообщение исчезло и вернулось позже — UPSERT снова переводит его в `В работе` с новым `ExportDate`.

### Поле ExportDate

`ExportDate` — дата и время последнего запуска парсера, в котором сообщение присутствовало как активное. Используется для фильтрации «показать сообщения из выгрузки за период». По умолчанию на странице отображаются только сообщения сегодняшней выгрузки.

### Интерфейс ([NgOverdueDashboard.tsx](frontend/src/components/Analytics/NgOverdueDashboard.tsx))

**Фильтры:**
- чипы по районам (все 13 районов ЮВАО + АВД);
- период выгрузки «с / по» (по `ExportDate`), по умолчанию — сегодня;
- поиск по номеру заявки.

**Столбчатая диаграмма** (Recharts):
- три цвета: красный — Просрок, оранжевый — 6–8 день, синий — 1–5 день;
- на вершине каждого столбика — суммарное число сообщений;
- реагирует на фильтры районов и периода.

**Режим сравнения** (кнопка «Сравнить»):
- выбирается второй период;
- на графике отображаются два столбика рядом: серый (основной период) и синий (период сравнения);
- между столбиками автоматически рисуется стрелка с разницей:
  - красная `↑N` — в периоде сравнения сообщений больше (ситуация ухудшилась);
  - зелёная `↓N` — сообщений меньше (ситуация улучшилась).

**Таблица** (колонки в порядке отображения):

| # | Колонка             | Описание                                              |
|---|---------------------|-------------------------------------------------------|
| 1 | Номер сообщения     | Ссылка на карточку на портале er.mos.ru               |
| 2 | День                | 1–8 день / Просрок; бейдж с цветом по срочности      |
| 3 | Статус              | В работе (янтарный) / Устранено (зелёный)             |
| 4 | Дата выгрузки       | `ExportDate` — когда сообщение последний раз активно видно в выгрузке |
| 5 | Дата публикации     | Дата публикации сообщения на портале                  |
| 6 | Район               | Район ЮВАО                                            |
| 7 | Регл. срок (Портал) | Регламентный срок ответа                              |
| 8 | Статус ответа       | Статус подготовки ответа                              |
| 9 | Адрес               | Адрес объекта                                         |
|10 | Проблемная тема     | Категория обращения                                   |
|11 | Просрок (Монитор)   | Признак просрочки по данным Монитора; пусто → «Нет признака» |

**Подсветка строк:**
- `Просрок` — насыщенный пастельный красный;
- `6–8 день` — мягкий пастельный красный;
- остальные дни — без подсветки.

**Excel-экспорт** — кнопка «Выгрузить Excel» формирует запрос к `GET /api/ng_overdue/export` с текущими фильтрами (период, районы, поиск). В файл попадают только строки, видимые в таблице.

---

## Переменные окружения (.env)

```env
# Парсеры
LOGIN_NG=...
PASSWORD_NG=...
LOGIN_MM=...
PASSWORD_MM=...
LOGIN_TSAFAP=...
PASSWORD_TSAFAP=...

# JWT — сгенерировать: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=...

# TDM (корпоративный мессенджер)
TDM_TOKEN=...
TDM_REPORT_GROUP_ID=...
TDM_REST_URL=https://api.tdm.mos.ru
TDM_FILE_UPLOAD_URL=https://fileupload.tdm.mos.ru

# Сервер
SERVER_IP=...
SERVER_USER=root
REMOTE_REPORTS_PATH=/var/www/reports
```

---

## Запуск

### Backend

```bash
pip install -r backend/requirements.txt
python run.py
```

API: `http://localhost:5000`  
Документация (Swagger): `http://localhost:5000/docs`

### Frontend (разработка)

```bash
cd frontend
npm install
npm run dev
```

Дев-сервер: `http://localhost:5173`  
Запросы к `/api` проксируются на порт 5000.

### Деплой на сервер

```bash
python deploy_full.py
```

Выполняет: `npm run build` → очистка → загрузка `dist/` по SCP → перезапуск nginx.

---

## API

| Метод  | Путь                              | Auth          | Описание                                                        |
|--------|-----------------------------------|---------------|-----------------------------------------------------------------|
| POST   | `/api/auth/login`                 | —             | Вход, возвращает JWT                                            |
| GET    | `/api/report-status`              | —             | Статус последних генераций                                      |
| GET    | `/api/files`                      | —             | Последние файлы в папке                                         |
| GET    | `/api/archive`                    | —             | Список архивных отчётов                                         |
| GET    | `/api/archive/download`           | —             | Скачать файл из архива                                          |
| GET    | `/reports/{folder}/{file}`        | —             | Раздача файлов отчётов                                          |
| POST   | `/api/update-last-visit`          | user (JWT)    | Обновить время последнего визита                                |
| GET    | `/api/transfer-statistics`        | —             | Статистика переносов                                            |
| GET    | `/api/transfer-statistics/export` | —             | Экспорт статистики в Excel                                      |
| GET    | `/api/chart_data`                 | —             | Данные для графиков (MM_prosrok)                                |
| GET    | `/api/chart_filters`              | —             | Фильтры для графиков                                            |
| GET    | `/api/date_range`                 | —             | Диапазон дат в MM_prosrok                                       |
| DELETE | `/api/overdue/{id}`               | admin (JWT)   | Удалить просрочку (MM_prosrok)                                  |
| GET    | `/api/ng_overdue`                 | —             | Дашборд НГ — все записи NG_prosrok с полем `exportDate`         |
| GET    | `/api/ng_overdue/export`          | —             | Excel-выгрузка NG_prosrok с фильтрами (`export_date_from`, `export_date_to`, `districts`, `search`) |
| GET    | `/api/admin/verify`               | admin (JWT)   | Проверить права администратора                                  |
| POST   | `/api/admin/generate-report`      | admin (JWT)   | Запустить генерацию отчёта вручную                              |
| GET    | `/api/admin/users`                | admin (JWT)   | Список пользователей                                            |
| POST   | `/api/admin/users`                | admin (JWT)   | Создать пользователя                                            |
| PUT    | `/api/admin/users/{id}`           | admin (JWT)   | Обновить пользователя                                           |
| DELETE | `/api/admin/users/{id}`           | admin (JWT)   | Удалить пользователя                                            |
| GET    | `/api/admin/organizations`        | admin (JWT)   | Список организаций                                              |
| GET    | `/api/admin/dutys`                | admin (JWT)   | Список должностей                                               |
| GET    | `/api/admin/activity`             | admin (JWT)   | Активность пользователей                                        |

---

## Схема таблицы NG_prosrok

```sql
CREATE TABLE NG_prosrok (
    ID               TEXT PRIMARY KEY,  -- Номер заявки
    PublishDate      TEXT,              -- Дата публикации сообщения
    District         TEXT,              -- Район ЮВАО
    Deadline         TEXT,              -- Регламентный срок (Портал)
    PreparationStatus TEXT,             -- Статус подготовки ответа
    Address          TEXT,              -- Адрес объекта
    Problem          TEXT,              -- Проблемная тема
    MonitorOverdue   TEXT,              -- Просрок (Монитор)
    Day              TEXT,              -- 1–8 день / Просрок
    Status           TEXT,              -- В работе / Устранено
    FirstSeen        TEXT,              -- Дата первой фиксации в БД
    LastSeen         TEXT,              -- Дата последнего обновления
    ExportDate       TEXT               -- Дата последней активной выгрузки
)
```

---

## Требования

- Python 3.11+ (Windows — для Excel/Word автоматизации)
- Node.js 18+
- Google Chrome + ChromeDriver (управляется автоматически через webdriver-manager)
- WireGuard (на Windows-машине и на сервере) — для связи FastAPI с nginx
- Настроенный SSH-ключ `~/.ssh/id_ed25519` для деплоя (SCP-загрузка `dist/` и отчётов)
