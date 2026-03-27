const request = require('supertest');
const app = require('../server'); // Шлях до вашого файлу сервера
const db = require('../db');     // Шлях до налаштувань БД

describe('INTEGRATED: Взаємодія API та Бази Даних СТО', () => {

    // Тест IT-1 (на основі TC1.1)
    test('IT-1: Створення клієнта має записувати дані в БД', async () => {
        const response = await request(app)
            .post('/api/clients')
            .send({ name: "Олексій Тестовий", phone: "+380991112233" });
        
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('id');
        
        // Перевірка в базі даних (Spy/Mock концепція)
        const client = await db.get("SELECT * FROM clients WHERE name = ?", ["Олексій Тестовий"]);
        expect(client).toBeDefined();
    });

    // Тест IT-4 (на основі TC4.2 - Негативний)
    test('IT-4: Запит інвойсу для неіснуючого замовлення повертає 404', async () => {
        const response = await request(app).get('/api/orders/99999/invoice');
        expect(response.statusCode).toBe(404);
    });

    // Тест IT-3 (Spy/Mock приклад для авторизації)
    test('IT-3: Система блокує доступ при невірних облікових даних', async () => {
        const loginSpy = jest.spyOn(app, 'post'); // Стежимо за викликом методу
        const response = await request(app)
            .post('/api/login')
            .send({ email: "admin@sto.com", password: "wrong_password" });
        
        expect(response.statusCode).toBe(401);
        loginSpy.mockRestore();
    });

    // Тест IT-5 (Оновлення статусу)
    test('IT-5: Зміна статусу замовлення в БД', async () => {
        const response = await request(app)
            .patch('/api/orders/1')
            .send({ status: "Завершено" });
        
        expect(response.statusCode).toBe(200);
    });

    // Закриваємо рядки авторизації та профілю (рядки 25-27, 37)
    test('IT-Auth: Тест авторизації та отримання профілю', async () => {
    const loginData = { username: "admin", password: "password" };
    const res = await request(app).post('/api/login').send(loginData);
    expect(res.statusCode).toBe(200);
    
    const profile = await request(app).get('/api/profile');
    expect(profile.statusCode).toBe(200);
    });

    // Закриваємо рядки роботи з авто та замовленнями (рядки 56-60, 67-72, 88-96)
    test('IT-Data: Робота з авто та статусами замовлень', async () => {
    // Перевірка списку авто
    const cars = await request(app).get('/api/cars');
    expect(cars.statusCode).toBe(200);

    // Спроба оновити статус (закриває логіку оновлення)
    const updateStatus = await request(app)
        .patch('/api/orders/1')
        .send({ status: "Виконано" });
    expect(updateStatus.statusCode).toBe(200);
    });

    // Закриваємо блоки помилок catch та 404 (рядки 139-140, 150)
    test('IT-Error: Обробка відсутніх маршрутів та помилок', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.statusCode).toBe(404);
    });


    test('IT-Clients-Get: Отримання списку всіх клієнтів (FR-1)', async () => {
    const response = await request(app).get('/api/clients');
    
    // Перевіряємо, що сервер відповів успішно
    expect(response.statusCode).toBe(200);
    
    // Перевіряємо, що отримана відповідь є масивом
    expect(Array.isArray(response.body)).toBeTruthy();
    
    // Якщо в базі є дані, перевіряємо наявність обов'язкових полів у першого клієнта
    if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('phone');
    }
    });

    // Тест для покриття помилок знаходження (Row not found)
    test('DB-Coverage: Спроба отримати інвойс для неіснуючого замовлення', async () => {
    const response = await request(app).get('/api/orders/9999/invoice');
    // Це активує рядок: if (!row) return res.status(404)...
    expect(response.statusCode).toBe(404);
    });

    // Тест для покриття помилок унікальності (Constraint Error)
    test('DB-Coverage: Спроба створити клієнта з дублікатом телефону', async () => {
    const client = { name: "Дублікат", phone: "+380000000000" };
    // Перший запит створює
    await request(app).post('/api/clients').send(client);
    // Другий запит провокує помилку UNIQUE constraint
    const response = await request(app).post('/api/clients').send(client);
    
    // Це активує рядок: if (err) return res.status(400)...
    expect(response.statusCode).toBe(400);
    });

    // Тест для покриття видалення (this.changes === 0)
    test('DB-Coverage: Видалення клієнта, якого не існує', async () => {
    const response = await request(app).delete('/api/clients/9999');
    // Це активує рядок: if (this.changes === 0)...
    expect(response.statusCode).toBe(404);
    });

    // Тест для покриття гілки "Клієнта не знайдено" (рядки 64-68)
    test('BRANCH-1: Спроба видалення неіснуючого клієнта', async () => {
    const nonExistentId = 999999;
    const response = await request(app).delete(`/api/clients/${nonExistentId}`);
    
    // Це активує гілку "if (this.changes === 0)"
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe("Клієнта не знайдено");
    });

    // Тест для покриття гілки "Замовлення не знайдено" (рядки 116-117)
    test('BRANCH-2: Запит інвойсу для неіснуючого замовлення', async () => {
    const nonExistentOrderId = 888888;
    const response = await request(app).get(`/api/orders/${nonExistentOrderId}/invoice`);
    
    // Це активує гілку "if (!row)"
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe("Замовлення не знайдено");
    });
    
    test('BRANCH-3: Створення замовлення без вибраних послуг', async () => {
    const orderData = { 
        vehicle_id: 1, 
        description: "Діагностика", 
        items: [] // Порожній список послуг активує гілку "1=0" або дефолтну ціну
    };
    const response = await request(app).post('/api/orders').send(orderData);
    
    expect(response.statusCode).toBe(201);
    // Це закриває розгалуження в рядку, де розраховується total_cost
    expect(response.body).toHaveProperty('total_cost');
    });

    test ('COVER-34-38: Перевірка успішного входу та даних профілю', async () => {
        const loginRes = await request (app)
            .post('/api/clients')
            .send({ email: ""})
    }
    )
});