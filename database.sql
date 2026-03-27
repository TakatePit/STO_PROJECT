-- 1. Таблиця клієнтів
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    'name' TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE
);

-- 2. Таблиця автомобілів (використовуємо назву vehicles, як у коді server.js)
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    vin TEXT UNIQUE NOT NULL,
    plate TEXT NOT NULL, -- Додано номерний знак для JOIN-запитів
    'year' INTEGER,
    client_id INTEGER,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 3. Таблиця замовлень (необхідна для роботи /api/orders та інвойсів)
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    'description' TEXT,
    'status' TEXT DEFAULT 'Очікує',
    'date' TEXT,
    total_cost REAL DEFAULT 0,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 4. Таблиця послуг (Прайс-лист для розрахунку вартості в server.js)
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    'name' TEXT NOT NULL,
    price REAL NOT NULL
);

-- Тестові дані для прайс-листа (щоб POST /api/orders не повертав помилку)
INSERT INTO services (name, price) VALUES ('Заміна мастила', 800);
INSERT INTO services (name, price) VALUES ('Діагностика ходової', 400);
INSERT INTO services (name, price) VALUES ('Ремонт двигуна', 5000);