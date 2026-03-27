const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./sto.db');

db.serialize(() => {
    // 1. Клієнти
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE
    )`);

    // 2. Автомобілі
    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        brand TEXT, model TEXT, vin TEXT UNIQUE, plate TEXT, year INTEGER,
        FOREIGN KEY(client_id) REFERENCES clients(id)
    )`);

    // 3. Послуги та запчастини
    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, price REAL, type TEXT -- 'work' або 'part'
    )`);

    // 4. Замовлення
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER,
        description TEXT,
        status TEXT DEFAULT 'Очікує', -- Очікує, В роботі, Завершено
        date TEXT,
        total_cost REAL DEFAULT 0,
        FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
    )`);
});

module.exports = db;