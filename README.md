# STO Project

Невеликий навчальний проєкт для керування процесами СТО (станції техобслуговування): клієнти, авто, замовлення, базова авторизація, рахунки та автотести.

## Основні можливості

- REST API на `Express` для роботи з клієнтами, авто та замовленнями.
- Зберігання даних у `SQLite` (`sto.db`).
- Проста веб-сторінка в `public/index.html`.
- Unit, integration та e2e (Cucumber) тести.
- Генерація звіту покриття тестами.

## Вимоги до репозиторію

- Містить файл `README.md` з описом проєкту.
- Містить файл ліцензії `LICENSE`.
- Не повинен містити приватну/чутливу інформацію (токени, ключі, паролі, секрети).
- Файл `.env` виключено з Git через `.gitignore`.

## Структура репозиторію

- `server.js` - основний HTTP сервер і API маршрути.
- `db.js` - підключення до бази та робота з SQLite.
- `database.sql` - SQL схема/скрипт для структури БД.
- `seed.js` - заповнення БД тестовими/початковими даними.
- `logic.js` - допоміжна бізнес-логіка для окремих сценаріїв.
- `load_test.js` - скрипт навантажувального тестування.
- `sto.db` - файл SQLite бази даних.
- `package.json` - метадані проєкту, скрипти та залежності.
- `package-lock.json` - lock-файл версій npm-залежностей.
- `.gitignore` - перелік файлів/папок, що не потрапляють у Git.
- `public/` - статичні файли фронтенду.
- `public/index.html` - головна веб-сторінка застосунку.
- `tests/` - набір автоматизованих тестів.
- `tests/unit.test.js` - unit-тести.
- `tests/integration.test.js` - інтеграційні тести API.
- `tests/logic.js` - допоміжний тестовий модуль.
- `features/` - BDD сценарії Cucumber.
- `features/sto_workflow.feature` - опис бізнес-сценаріїв у форматі Gherkin.
- `features/step_definitions/steps.js` - реалізація кроків для Cucumber.
- `coverage/` - артефакти звіту про покриття тестами.
- `node_modules/` - встановлені npm-залежності (службова папка).
- `docs/linting.md` - документація з лінтингу.
- `docs/architecture.md` - архітектура, доменна логіка, взаємодія компонентів.
- `docs/generate_docs.md` - як згенерувати HTML-документацію (JSDoc).
- `jsdoc.json` - конфігурація JSDoc.
- `docs/deployment-architecture.md` - складові системи та діаграма для розгортання.
- `docs/deployment.md` - розгортання у production (DevOps).
- `docs/update.md` - оновлення системи та rollback.
- `docs/backup.md` - резервне копіювання БД та відновлення.
- `docs/scripts/` - скрипти dev/prod (`dev.*`, `start-prod.*`, `run-prod.js`) та `README.md`.
- `Procfile` - визначення процесу для Foreman / аналогів.

## Швидкий старт для розробника (з «чистої» ОС)

Припускається: немає Node, немає клонованого репозиторію. **Windows** нижче з PowerShell / cmd; для **Linux/macOS** команди аналогічні (`sudo`, `apt`, `brew` тощо за політикою ОС).

### 1. Необхідне ПЗ

| Компонент | Призначення | Де взяти |
|-----------|-------------|----------|
| **Git** | Клонування репозиторію | [git-scm.com](https://git-scm.com/) |
| **Node.js LTS** | Runtime і `npm` | [nodejs.org](https://nodejs.org/) (встановлення з галочкою «Add to PATH» на Windows) |

Перевірка після встановлення (новий термінал):

```bash
git --version
node -v
npm -v
```

Рекомендовано: **Visual Studio Code** або інший редактор з підтримкою JavaScript.

### 2. Клонування та перехід у каталог

```bash
git clone <URL-вашого-репозиторію>
cd sto_project
```

### 3. Встановлення залежностей проєкту

**Варіант A (рекомендовано на практиці):**

```bash
npm install
```

**Варіант B (скрипт «одним кліком»):**

- Windows: `docs\scripts\dev.bat`
- Linux/macOS: `chmod +x docs/scripts/dev.sh docs/scripts/start-prod.sh` (один раз), потім `./docs/scripts/dev.sh`

Це виконає `npm install` у корені репозиторію.

### 4. База даних SQLite

Файл **`sto.db`** з’являється в корені проєкту **після першого запуску** додатка або імпорту `db.js`. Таблиці створюються автоматично в **`db.js`** (`CREATE TABLE IF NOT EXISTS`). Окремий сервер СУБД не потрібен.

Опційно заповнити демо-дані:

```bash
npm run seed
```

(Обережно: `seed.js` очищає таблиці перед вставкою — лише для dev/demo.)

### 5. Запуск у режимі розробки

```bash
npm start
```

Відкрий у браузері: **http://localhost:3000**

У режимі розробки `NODE_ENV` не дорівнює `test`, тому сервер слухає порт **3000**.

### 6. Базові команди

| Команда | Опис |
|---------|------|
| `npm start` | Запуск HTTP-сервера (development за замовчуванням) |
| `npm run start:prod` | Запуск з `NODE_ENV=production` (через `docs/scripts/run-prod.js`) |
| `npm test` | Unit + інтеграційні тести (Jest) |
| `npm run test:e2e` | Cucumber сценарії |
| `npm run lint` | ESLint |
| `npm run build` | Лінт + перевірка типів + тести |
| `npm run docs` | Генерація JSDoc HTML у `docs/jsdoc/` |
| `npm run seed` | Наповнення БД демо-даними |

Автоматизація production-старту на **Windows:** `docs\scripts\start-prod.bat`; **Unix:** `./docs/scripts/start-prod.sh`. Інструкції для DevOps: **`docs/deployment.md`**, **`docs/update.md`**, **`docs/backup.md`**.

### 7. Діаграма та складові для звітів

Опис архітектури з точки зору розгортання (веб-сервер, СУБД, кеш тощо): **`docs/deployment-architecture.md`**.

## Запуск проєкту

```bash
npm install
npm start
```

Сервер запускається на `http://localhost:3000`.

## Тестування

```bash
npm test
npm run test:e2e
```

## Документація коду (для контриб’юторів)

Щоб усі, хто долучається до проєкту, підтримували однаковий підхід:

1. **JSDoc** (`/** ... */`) для публічних модулів і функцій у файлах, з яких збирається API-документація: `server.js`, `db.js`, `logic.js`, `seed.js`, тестовий хелпер `tests/logic.js`. Описуйте призначення, параметри (`@param`), повернення (`@returns`), для об’єктів — `@typedef` / `@property` за потреби. Маршрути HTTP позначайте тегом `@route` (наприклад, `POST /api/clients`).
2. **Один блок без зайвого порожнього рядка** між коротким описом і наступним тегом — так вимагає правило `jsdoc/tag-lines` у ESLint.
3. Після змін у коді оновлюйте коментарі в тому ж коміті; не залишайте застарілі `@param` / `@returns`.
4. **Архітектура, домен і неочевидні місця** — у `docs/architecture.md` (схема шарів, замовлення/інвойс, застереження щодо безпеки SQL у демо-коді).
5. **Генерація HTML з JSDoc:** див. `docs/generate_docs.md`, команда `npm run docs` (вихід у `docs/jsdoc/`, каталог у `.gitignore`; для здачі — zip з цієї папки).
6. **Перевірка якості коментарів:** `npm run lint` (підключено `eslint-plugin-jsdoc` для перелічених файлів).
7. **Жива документація (приклади):** контракт доменної логіки — `tests/unit.test.js`; контракт HTTP API — `tests/integration.test.js`. Змінюючи поведінку, оновлюйте відповідні тести як зразки використання.

