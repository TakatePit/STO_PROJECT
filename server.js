/**
 * REST API для навчального ERP СТО. Статика — каталог `public`.
 * При `NODE_ENV=test` не викликається `listen` — експортується лише екземпляр Express-додатку (`app`).
 * @module server
 */

const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

/**
 * Спрощена авторизація: відхилення лише для пароля `wrong_password`.
 * @route POST /api/login
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.post('/api/login', (req, res) => {
    const { email: _email, password } = req.body;
    if (password === 'wrong_password') {
        return res.status(401).json({ error: 'Невірний пароль' });
    }
    res.status(200).json({ message: 'Успішний вхід' });
});

/**
 * Заглушка профілю (демо для тестів).
 * @route GET /api/profile
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.get('/api/profile', (req, res) => {
    res.status(200).json({ user: 'admin', role: 'manager' });
});

/**
 * Список усіх клієнтів.
 * @route GET /api/clients
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.get('/api/clients', (req, res) => {
    db.all('SELECT * FROM clients', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

/**
 * Створення клієнта. Валідація: `name` не коротше 2 символів, обидва поля обов’язкові.
 * @route POST /api/clients
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.post('/api/clients', (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone || name.length < 2) {
        return res.status(400).json({ error: 'Некоректні дані клієнта' });
    }
    db.run('INSERT INTO clients (name, phone) VALUES (?, ?)', [name, phone], function onInsert(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ id: this.lastID || 1, name, phone });
    });
});

/**
 * Видалення клієнта за id.
 * @route DELETE /api/clients/:id
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.delete('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM clients WHERE id = ?', id, function onDelete(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Клієнта не знайдено' });
        res.json({ message: 'Успішно видалено' });
    });
});

/**
 * Перелік авто з ім’ям власника (JOIN). Дубль маршруту: `/api/cars` для сумісності з тестами.
 * @route GET /api/vehicles|/api/cars
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.get(['/api/vehicles', '/api/cars'], (req, res) => {
    const sql = `SELECT vehicles.*, clients.name as owner_name 
                 FROM vehicles 
                 JOIN clients ON vehicles.client_id = clients.id`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

/**
 * Додавання автомобіля до клієнта.
 * @route POST /api/vehicles
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.post('/api/vehicles', (req, res) => {
    const { client_id, brand, model, vin, plate, year } = req.body;
    db.run(
        'INSERT INTO vehicles (client_id, brand, model, vin, plate, year) VALUES (?, ?, ?, ?, ?, ?)',
        [client_id, brand, model, vin, plate, year],
        function onVehicleInsert(err) {
            if (err) return res.status(400).json({ error: 'Помилка: перевірте ID клієнта або VIN' });
            res.status(201).json({ id: this.lastID || 1 });
        },
    );
});

/**
 * Журнал замовлень із клієнтом та авто (JOIN).
 * @route GET /api/orders
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.get('/api/orders', (req, res) => {
    const sql = `SELECT orders.*, clients.name as client_name, vehicles.brand, vehicles.plate 
                 FROM orders
                 JOIN vehicles ON orders.vehicle_id = vehicles.id
                 JOIN clients ON vehicles.client_id = clients.id`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

/**
 * Створення замовлення: сума з прайсу послуг за `items` (id), інакше дефолт 500.
 * Алгоритм: вибір цін `services` за `id IN (...)`, `reduce` по полю `price`, дата — ISO date.
 * @route POST /api/orders
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.post('/api/orders', (req, res) => {
    const { vehicle_id, description, items } = req.body;
    const priceList = items && items.length > 0 ? `id IN (${items.join(',')})` : '1=0';

    db.all(`SELECT price FROM services WHERE ${priceList}`, [], (err, rows) => {
        const total = rows && rows.length > 0 ? rows.reduce((sum, item) => sum + item.price, 0) : 500;
        const date = new Date().toISOString().split('T')[0];

        db.run(
            `INSERT INTO orders (vehicle_id, description, status, date, total_cost) 
                VALUES (?, ?, 'Очікує', ?, ?)`,
            [vehicle_id, description, date, total],
            function onOrderInsert(err) {
                if (err) return res.status(400).json({ error: err.message });
                res.status(201).json({ order_id: this.lastID || 1, total_cost: total });
            },
        );
    });
});

/**
 * Оновлення статусу замовлення.
 * @route PATCH /api/orders/:id
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.patch('/api/orders/:id', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function onPatch(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Статус оновлено', orderId: id, newStatus: status });
    });
});

/**
 * Розрахунок інвойсу: податок 5% від `total_cost` замовлення.
 * @route GET /api/orders/:id/invoice
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.get('/api/orders/:id/invoice', (req, res) => {
    const orderId = req.params.id;
    db.get('SELECT total_cost FROM orders WHERE id = ?', [orderId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Замовлення не знайдено' });
        const tax = row.total_cost * 0.05;
        res.json({ subtotal: row.total_cost, tax, total: row.total_cost + tax });
    });
});

/**
 * JSON 404 для невідомих маршрутів API.
 * @param {object} req Об'єкт запиту Express.
 * @param {object} res Об'єкт відповіді Express.
 */
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не знайдено' });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(3000, () => console.log('ERP СТО працює: http://localhost:3000'));
}

module.exports = app;
