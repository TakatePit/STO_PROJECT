/**
 * Підключення до SQLite та створення таблиць `clients`, `vehicles`, `services`, `orders`
 * при першому імпорті модуля. Шлях до файлу БД відносний: `./sto.db`.
 *
 * **Важливо:** один процес — одне підключення; тести й `server.js` ділять той самий файл.
 * @module db
 * @see {@link module:server} HTTP-шар, що використовує це підключення
 */

const sqlite3 = require('sqlite3').verbose();

/** Екземпляр БД з методами `run`, `get`, `all`, `serialize` (node-sqlite3). */
const db = new sqlite3.Database('./sto.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        brand TEXT, model TEXT, vin TEXT UNIQUE, plate TEXT, year INTEGER,
        FOREIGN KEY(client_id) REFERENCES clients(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, price REAL, type TEXT -- 'work' або 'part'
    )`);

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
