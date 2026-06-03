# CarFlow

CRM-система для СТО: клієнти та авто, довідник послуг, наряди з рядками, канбан статусів, онлайн-запис з тижневим календарем, реєстрація клієнта з прив’язкою до картки за телефоном, рольова авторизація (admin/client). REST API на Express; основний UI — React + Vite у каталозі `frontend/` з проксі `/api` на бекенд.

## Основні можливості

- REST API (`backend/src/`) для CRM, замовлень, записів, авторизації.
- Зберігання даних у PostgreSQL або in-memory Postgres (`pg-mem`) для тестів і UI-прогону (`USE_IN_MEMORY_DB=true`).
- SPA: `frontend/` (Vite dev-сервер, за замовчуванням порт **5173**).
- Статичні сторінки-наслідки в `public/` (`login.html`, `register.html` тощо) — не основний робочий інтерфейс.
- Автотести: Jest (unit + інтеграція API), Cucumber (e2e), Playwright (`npm run test:ui`).
- Звіт покриття Jest.

## Вимоги до репозиторію

- Містить файл `README.md` з описом проєкту.
- Містить файл ліцензії `LICENSE`.
- Не повинен містити приватну/чутливу інформацію (токени, ключі, паролі, секрети).
- Файл `.env` виключено з Git через `.gitignore`.

## Структура репозиторію

- `server.js` — точка входу HTTP-сервера (імпортує Express-додаток з `backend/src/app.js`).
- `backend/src/` — API: модулі маршрутів, middleware, міграції SQL у `backend/src/db/migrations/`.
- `shared/` — спільні константи/типи для сумісності з кореневим кодом.
- `frontend/` — React + TypeScript + Vite (основний UI).
- `db.js` — пул PostgreSQL або pg-mem, базова схема й дані адміністратора за замовчуванням.
- `database.sql` — довідкова SQL-схема.
- `seed.js` — заповнення БД демо-даними (лише dev/demo).
- `logic.js` — допоміжна бізнес-логіка.
- `scripts/migrate.js` — застосування міграцій у прод-подібному режимі.
- `package.json` — скрипти та залежності кореня.
- `public/` — статичні HTML/CSS/JS для простих сторінок.
- `tests/` — Jest (`unit.test.js`, `integration.test.js`), Cucumber (`features/`), Playwright (`tests/ui/`).
- `playwright.config.cjs` — конфігурація UI-тестів.
- `middleware/`, `errors/`, `locales/`, `logger.js` — логування, контекст запиту, помилки, переклади.
- `docs/` — архітектура, розгортання, лінтинг, стандарти продукту (`docs/product-standards.md`).
- `jsdoc.json` — конфігурація JSDoc.

## Швидкий старт для розробника (з «чистої» ОС)

Припускається: немає Node, немає клонованого репозиторію. **Windows** нижче з PowerShell / cmd; для **Linux/macOS** команди аналогічні.

### 1. Необхідне ПЗ

| Компонент | Призначення | Де взяти |
|-----------|-------------|----------|
| **Git** | Клонування репозиторію | [git-scm.com](https://git-scm.com/) |
| **Node.js LTS** | Runtime і `npm` | [nodejs.org](https://nodejs.org/) |

Перевірка:

```bash
git --version
node -v
npm -v
```

### 2. Клонування та перехід у каталог

```bash
git clone <URL-вашого-репозиторію>
cd sto_project
```

### 3. Встановлення залежностей

```bash
npm install
```

Для Playwright один раз потрібні браузери (для `npm run test:ui`):

```bash
npx playwright install chromium
```

### 4. База даних PostgreSQL

Створи БД PostgreSQL та налаштуй змінні середовища (приклад для PowerShell):

```bash
set DATABASE_URL=postgres://postgres:postgres@localhost:5432/sto_project
set JWT_SECRET=your_secret
set ADMIN_EMAIL=admin@sto.local
set ADMIN_PASSWORD=Admin123!
```

Схема піднімається при старті через ланцюжок `backend/src/db` + кореневий `db.js` та міграції.

Демо-дані (обережно: `seed.js` очищає ключові таблиці):

```bash
npm run seed
```

### 5. Запуск CarFlow

**Рекомендовано (одна команда — API + новий UI):**

```bash
npm run dev
```

У браузері відкрийте **http://127.0.0.1:5173** — повноцінний React-інтерфейс (єдине вікно входу/реєстрації) і проксі на API (**http://127.0.0.1:3000**). Перший запуск сам підтягне залежності `frontend/`, якщо їх ще немає.

**Якщо потрібен лише один порт (наприклад, 3000):**

```bash
npm run start:with-ui
```

Спочатку збирається `frontend/dist`, потім стартує сервер — новий інтерфейс відкривається за **http://127.0.0.1:3000**.

**Окремо два термінали** (за потреби): `npm start` і в іншому вікні `npm run frontend:dev`, потім знову **http://127.0.0.1:5173**.

Вхід і реєстрація — одна форма для всіх ролей; після входу відкривається інтерфейс залежно від облікового запису. Облікові дані першого адміністратора задаються в `db.js` через змінні `ADMIN_EMAIL` та `ADMIN_PASSWORD` (або значення за замовчуванням у коді). Реєстрація нового клієнта — вкладка «Створити акаунт».

### 6. Базові команди

| Команда | Опис |
|---------|------|
| `npm run dev` | API + Vite одночасно (новий UI на порту 5173) |
| `npm run start:with-ui` | Збірка фронту та запуск лише сервера (UI на порту 3000) |
| `npm start` | Запуск HTTP-сервера |
| `npm run frontend:dev` | Dev-сервер Vite (`frontend/`) |
| `npm run frontend:build` | Збірка фронту у `frontend/dist` |
| `npm run start:prod` | Production-режим через `docs/scripts/run-prod.js` |
| `npm test` | Jest (unit + інтеграція) |
| `npm run test:ui` | Playwright UI-регрес (піднімає API + Vite автоматично) |
| `npm run test:e2e` | Cucumber |
| `npm run lint` | ESLint |
| `npm run build` | Лінт + перевірка типів + тести |
| `npm run docs` | JSDoc HTML у `docs/jsdoc/` |
| `npm run seed` | Демо-дані |

Деталі розгортання: **`docs/deployment.md`**, **`docs/update.md`**, **`docs/backup.md`**.

### 7. Діаграма та складові для звітів

**`docs/deployment-architecture.md`**.

## Запуск без локального Postgres (in-memory)

Для швидкої перевірки або коли БД ще не піднята:

```bash
set USE_IN_MEMORY_DB=true
set JWT_SECRET=dev_secret
npm start
```

Так само використовуються інтеграційні тести й глобальний setup Playwright.

## Тестування

```bash
npm test
npm run test:e2e
npm run test:ui
```

`test:ui` очікує встановлений Chromium (`npx playwright install chromium`).

## Документація коду (для контриб’юторів)

1. **JSDoc** для публічних модулів і функцій у файлах, з яких збирається документація: `server.js`, `db.js`, `logic.js`, `seed.js`, тестовий хелпер `tests/logic.js`. Описуйте призначення, `@param`, `@returns`; для HTTP — тег `@route` (наприклад, `POST /api/clients`).
2. **Один блок без зайвого порожнього рядка** між коротким описом і наступним тегом — вимога `jsdoc/tag-lines` у ESLint.
3. Після змін оновлюйте коментарі в тому ж коміті.
4. **Архітектура** — `docs/architecture.md`.
5. **JSDoc HTML:** `docs/generate_docs.md`, команда `npm run docs`.
6. **Перевірка коментарів:** `npm run lint`.
7. **Приклади контрактів:** `tests/unit.test.js`, `tests/integration.test.js`, `tests/ui/regression.spec.js`.

**Логування:** змінна `LOG_LEVEL`; каталог `LOG_DIR` (за замовчуванням `./logs`). Деталі: **`docs/logging.md`**.
