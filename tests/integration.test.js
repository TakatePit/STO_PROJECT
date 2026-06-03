const request = require('supertest');
const app = require('../server');
const { query, closeDb } = require('../db');

describe('INTEGRATED: Адмін + клієнтський кабінет', () => {
    let adminToken = '';

    afterAll(async () => {
        await closeDb();
    });

    test('адмін логіниться дефолтним акаунтом', async () => {
        const response = await request(app).post('/api/auth/login').send({
            email: 'admin@sto.local',
            password: 'Admin123!',
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.user.role).toBe('admin');
        expect(response.body).toHaveProperty('token');
        adminToken = response.body.token;
    });

    test('адмін створює клієнта, авто і замовлення з розрахунком', async () => {
        const clientRes = await request(app)
            .post('/api/clients')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                full_name: 'Олексій Тестовий',
                phone: `+38099${Date.now().toString().slice(-7)}`,
                notes: 'Тестовий запис',
            });
        expect(clientRes.statusCode).toBe(201);

        const vehicleRes = await request(app)
            .post('/api/vehicles')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                client_id: clientRes.body.id,
                brand: 'Skoda',
                model: 'Octavia',
                vin: `VIN${Date.now().toString().padEnd(17, '0').slice(0, 17)}`,
                plate: `AA${Math.floor(Math.random() * 8999 + 1000)}BB`,
                year: 2021,
            });
        expect(vehicleRes.statusCode).toBe(201);

        const serviceRes = await request(app).get('/api/services').set('Authorization', `Bearer ${adminToken}`);
        expect(serviceRes.statusCode).toBe(200);
        expect(serviceRes.body.length).toBeGreaterThan(0);

        const orderRes = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                vehicle_id: vehicleRes.body.id,
                description: 'Планове ТО',
                items: [{ service_id: serviceRes.body[0].id, qty: 2 }],
            });
        expect(orderRes.statusCode).toBe(201);
        expect(orderRes.body.total_cost).toBeGreaterThan(0);
    });

    test('клієнт реєструється і бачить свій кабінет та історію', async () => {
        const stamp = Date.now();
        const registerRes = await request(app).post('/api/auth/register').send({
            full_name: 'Іван Клієнт',
            phone: `+38067${String(stamp).slice(-7)}`,
            email: `client${stamp}@sto.local`,
            password: 'Client123!',
        });
        expect(registerRes.statusCode).toBe(201);
        expect(registerRes.body.user.role).toBe('client');

        const token = registerRes.body.token;
        const profileRes = await request(app)
            .get('/api/client/profile')
            .set('Authorization', `Bearer ${token}`);
        expect(profileRes.statusCode).toBe(200);
        expect(profileRes.body.profile).toHaveProperty('email');

        const ordersRes = await request(app)
            .get('/api/client/orders')
            .set('Authorization', `Bearer ${token}`);
        expect(ordersRes.statusCode).toBe(200);
        expect(Array.isArray(ordersRes.body)).toBe(true);
    });

    test('роль client не может получить список клиентов админа', async () => {
        const loginRes = await request(app).post('/api/auth/login').send({
            email: 'admin@sto.local',
            password: 'wrong_password',
        });
        expect(loginRes.statusCode).toBe(401);

        const users = await query("SELECT email FROM users WHERE role = 'client' ORDER BY id DESC LIMIT 1");
        const clientEmail = users.rows[0].email;
        const clientLogin = await request(app).post('/api/auth/login').send({
            email: clientEmail,
            password: 'Client123!',
        });
        const clientToken = clientLogin.body.token;

        const forbiddenRes = await request(app)
            .get('/api/clients')
            .set('Authorization', `Bearer ${clientToken}`);
        expect(forbiddenRes.statusCode).toBe(403);
    });

    test('реєстрація привʼязує обліковий запис до картки клієнта за телефоном', async () => {
        const phone = `+38050${Date.now().toString().slice(-7)}`;
        const adminClient = await request(app)
            .post('/api/clients')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ full_name: 'Картка від адміна', phone, notes: '' });
        expect(adminClient.statusCode).toBe(201);
        const existingClientId = adminClient.body.id;

        const stamp = Date.now();
        const registerRes = await request(app).post('/api/auth/register').send({
            full_name: 'Імʼя у формі реєстрації',
            phone,
            email: `linked${stamp}@sto.local`,
            password: 'Client123!',
        });
        expect(registerRes.statusCode).toBe(201);
        expect(registerRes.body.client.id).toBe(existingClientId);

        const profileRes = await request(app)
            .get('/api/client/profile')
            .set('Authorization', `Bearer ${registerRes.body.token}`);
        expect(profileRes.statusCode).toBe(200);
        expect(profileRes.body.profile.id).toBe(existingClientId);
    });

    test('онлайн-запис створюється без конфлікту часу', async () => {
        const start = new Date(Date.now() + 3600 * 1000).toISOString();
        const end = new Date(Date.now() + 7200 * 1000).toISOString();
        const create = await request(app)
            .post('/api/appointments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ starts_at: start, ends_at: end, comment: 'Test appointment' });
        expect(create.statusCode).toBe(201);

        const conflict = await request(app)
            .post('/api/appointments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ starts_at: start, ends_at: end, comment: 'Conflict appointment' });
        expect(conflict.statusCode).toBe(409);
    });

});