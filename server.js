/**
 * REST API для навчального ERP СТО. Статика — каталог `public`.
 * Логування Winston, трасування X-Request-Id, централізовані помилки.
 * @module server
 */

const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const { logger } = require('./logger');
const requestContext = require('./middleware/requestContext');
const { httpLogger } = require('./middleware/httpLogger');
const { AppError } = require('./errors/AppError');
const { sendApiError, notFoundHandler, errorHandler } = require('./errors/httpErrorHandler');

process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', { reason: String(reason) });
});
process.on('uncaughtException', (e) => {
    logger.error('uncaughtException', { message: e.message, stack: e.stack });
});

if (process.env.NODE_ENV !== 'test') {
    logger.info('Запуск процесу STO ERP', { nodeEnv: process.env.NODE_ENV || 'development' });
}

const app = express();
app.use(requestContext);
app.use(httpLogger);
app.use(bodyParser.json());
app.use(express.static('public'));

/** Збір технічних повідомлень з фронтенду (лабораторна 7). */
app.post('/api/client-log', (req, res) => {
    const { message, source, url, line, col, stack } = req.body || {};
    logger.warn('Клієнтська помилка (JS)', {
        requestId: req.requestId,
        message,
        source,
        url,
        line,
        col,
        stack: stack ? String(stack).slice(0, 4000) : undefined,
        userAgent: req.get('user-agent'),
    });
    res.status(204).end();
});

/**
 * @route POST /api/login
 */
app.post('/api/login', (req, res) => {
    const { email: _email, password } = req.body;
    if (password === 'wrong_password') {
        return sendApiError(
            res,
            req,
            new AppError('STO_AUTH', 401, 'WRONG_PASSWORD', { fallbackMessage: 'Невірний пароль' }),
        );
    }
    logger.info('Авторизація успішна', { requestId: req.requestId });
    res.status(200).json({ message: 'Успішний вхід' });
});

/**
 * @route GET /api/profile
 */
app.get('/api/profile', (req, res) => {
    res.status(200).json({ user: 'admin', role: 'manager' });
});

/**
 * @route GET /api/clients
 */
app.get('/api/clients', (req, res) => {
    db.all('SELECT * FROM clients', [], (err, rows) => {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'listClients', detail: err.message },
                }),
            );
        }
        res.json(rows || []);
    });
});

/**
 * @route POST /api/clients
 */
app.post('/api/clients', (req, res) => {
    const { name, phone } = req.body;
    if (!name || !phone || name.length < 2) {
        return sendApiError(
            res,
            req,
            new AppError('STO_VALIDATION', 400, 'CLIENT_INVALID', {
                fallbackMessage: 'Некоректні дані клієнта',
                context: { hasName: Boolean(name), hasPhone: Boolean(phone) },
            }),
        );
    }
    db.run('INSERT INTO clients (name, phone) VALUES (?, ?)', [name, phone], function onInsert(err) {
        if (err) {
            logger.error('Помилка INSERT clients', {
                requestId: req.requestId,
                detail: err.message,
            });
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 400, 'DB_ERROR', {
                    context: { operation: 'insertClient', detail: err.message },
                }),
            );
        }
        logger.info('Створено клієнта', { requestId: req.requestId, id: this.lastID });
        res.status(201).json({ id: this.lastID || 1, name, phone });
    });
});

/**
 * @route DELETE /api/clients/:id
 */
app.delete('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM clients WHERE id = ?', id, function onDelete(err) {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'deleteClient', detail: err.message },
                }),
            );
        }
        if (this.changes === 0) {
            return sendApiError(
                res,
                req,
                new AppError('STO_NOT_FOUND', 404, 'CLIENT_NOT_FOUND', {
                    fallbackMessage: 'Клієнта не знайдено',
                    context: { clientId: id },
                }),
            );
        }
        logger.info('Видалено клієнта', { requestId: req.requestId, id });
        res.json({ message: 'Успішно видалено' });
    });
});

/**
 * @route GET /api/vehicles|/api/cars
 */
app.get(['/api/vehicles', '/api/cars'], (req, res) => {
    const sql = `SELECT vehicles.*, clients.name as owner_name 
                 FROM vehicles 
                 JOIN clients ON vehicles.client_id = clients.id`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'listVehicles', detail: err.message },
                }),
            );
        }
        res.json(rows || []);
    });
});

/**
 * @route POST /api/vehicles
 */
app.post('/api/vehicles', (req, res) => {
    const { client_id, brand, model, vin, plate, year } = req.body;
    db.run(
        'INSERT INTO vehicles (client_id, brand, model, vin, plate, year) VALUES (?, ?, ?, ?, ?, ?)',
        [client_id, brand, model, vin, plate, year],
        function onVehicleInsert(err) {
            if (err) {
                return sendApiError(
                    res,
                    req,
                    new AppError('STO_DB', 400, 'VEHICLE_INVALID', {
                        fallbackMessage: 'Помилка: перевірте ID клієнта або VIN',
                        context: { detail: err.message },
                    }),
                );
            }
            logger.info('Додано авто', { requestId: req.requestId, id: this.lastID });
            res.status(201).json({ id: this.lastID || 1 });
        },
    );
});

/**
 * @route GET /api/orders
 */
app.get('/api/orders', (req, res) => {
    const sql = `SELECT orders.*, clients.name as client_name, vehicles.brand, vehicles.plate 
                 FROM orders
                 JOIN vehicles ON orders.vehicle_id = vehicles.id
                 JOIN clients ON vehicles.client_id = clients.id`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'listOrders', detail: err.message },
                }),
            );
        }
        res.json(rows || []);
    });
});

/**
 * @route POST /api/orders
 */
app.post('/api/orders', (req, res) => {
    const { vehicle_id, description, items } = req.body;
    const priceList = items && items.length > 0 ? `id IN (${items.join(',')})` : '1=0';

    db.all(`SELECT price FROM services WHERE ${priceList}`, [], (err, rows) => {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'orderPriceQuery', detail: err.message },
                }),
            );
        }
        const total = rows && rows.length > 0 ? rows.reduce((sum, item) => sum + item.price, 0) : 500;
        const date = new Date().toISOString().split('T')[0];

        db.run(
            `INSERT INTO orders (vehicle_id, description, status, date, total_cost) 
                VALUES (?, ?, 'Очікує', ?, ?)`,
            [vehicle_id, description, date, total],
            function onOrderInsert(err) {
                if (err) {
                    return sendApiError(
                        res,
                        req,
                        new AppError('STO_DB', 400, 'DB_ERROR', {
                            context: { operation: 'insertOrder', detail: err.message },
                        }),
                    );
                }
                logger.info('Створено замовлення', { requestId: req.requestId, id: this.lastID, total });
                res.status(201).json({ order_id: this.lastID || 1, total_cost: total });
            },
        );
    });
});

/**
 * @route PATCH /api/orders/:id
 */
app.patch('/api/orders/:id', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id], function onPatch(err) {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'patchOrder', detail: err.message },
                }),
            );
        }
        res.status(200).json({ message: 'Статус оновлено', orderId: id, newStatus: status });
    });
});

/**
 * @route GET /api/orders/:id/invoice
 */
app.get('/api/orders/:id/invoice', (req, res) => {
    const orderId = req.params.id;
    db.get('SELECT total_cost FROM orders WHERE id = ?', [orderId], (err, row) => {
        if (err) {
            return sendApiError(
                res,
                req,
                new AppError('STO_DB', 500, 'INTERNAL', {
                    context: { operation: 'invoice', detail: err.message },
                }),
            );
        }
        if (!row) {
            return sendApiError(
                res,
                req,
                new AppError('STO_NOT_FOUND', 404, 'ORDER_NOT_FOUND', {
                    fallbackMessage: 'Замовлення не знайдено',
                    context: { orderId },
                }),
            );
        }
        const tax = row.total_cost * 0.05;
        res.json({ subtotal: row.total_cost, tax, total: row.total_cost + tax });
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
    app.listen(3000, () => {
        logger.info('ERP СТО працює', { url: 'http://localhost:3000', port: 3000 });
    });
}

module.exports = app;
