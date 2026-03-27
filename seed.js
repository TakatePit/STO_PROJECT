/**
 * Скрипт наповнення БД демонстраційними послугами, клієнтом, авто та замовленням.
 * Спочатку очищає таблиці (для стабільних локальних/навчальних прогонів).
 *
 * **Запуск:** `node seed.js` (потрібен вже ініціалізований `sto.db` через імпорт `db.js`).
 * @module seed
 */

const db = require('./db');

db.serialize(() => {
    db.run('DELETE FROM orders');
    db.run('DELETE FROM vehicles');
    db.run('DELETE FROM clients');
    db.run('DELETE FROM services');

    const services = [
        ['Заміна масла', 800, 'work'],
        ['Діагностика ходової', 400, 'work'],
        ['Фільтр масляний', 350, 'part'],
        ['Гальмівні колодки', 1200, 'part'],
    ];
    services.forEach((s) => db.run('INSERT INTO services (title, price, type) VALUES (?, ?, ?)', s));

    db.run("INSERT INTO clients (name, phone) VALUES ('Олександр Шевченко', '+380671112233')", function seedClient() {
        const clientId = this.lastID;

        db.run(`INSERT INTO vehicles (client_id, brand, model, vin, plate, year) 
                VALUES (?, 'Toyota', 'Camry', 'VIN1234567890ABC', 'AA1234BB', 2020)`, [clientId], function seedVehicle() {
            const vehicleId = this.lastID;

            db.run(`INSERT INTO orders (vehicle_id, description, status, date, total_cost) 
                    VALUES (?, 'Стукіт у підвісці, заміна масла', 'В роботі', '2024-05-20', 1550)`, [vehicleId]);

            console.log('База успішно наповнена тестовими даними!');
        });
    });
});
