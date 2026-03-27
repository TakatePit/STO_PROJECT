const db = require('./db');

db.serialize(() => {
    // Очищення старих даних для чистого звіту (як вимагає Лаб 5)
    db.run("DELETE FROM orders");
    db.run("DELETE FROM vehicles");
    db.run("DELETE FROM clients");
    db.run("DELETE FROM services");

    // 1. Додаємо послуги (Прайс-лист)
    const services = [
        ['Заміна масла', 800, 'work'],
        ['Діагностика ходової', 400, 'work'],
        ['Фільтр масляний', 350, 'part'],
        ['Гальмівні колодки', 1200, 'part']
    ];
    services.forEach(s => db.run("INSERT INTO services (title, price, type) VALUES (?, ?, ?)", s));

    // 2. Додаємо клієнта
    db.run("INSERT INTO clients (name, phone) VALUES ('Олександр Шевченко', '+380671112233')", function() {
        const clientId = this.lastID;

        // 3. Додаємо автомобіль цього клієнта
        db.run(`INSERT INTO vehicles (client_id, brand, model, vin, plate, year) 
                VALUES (?, 'Toyota', 'Camry', 'VIN1234567890ABC', 'AA1234BB', 2020)`, [clientId], function() {
            const vehicleId = this.lastID;

            // 4. Створюємо активне замовлення (Журнал)
            db.run(`INSERT INTO orders (vehicle_id, description, status, date, total_cost) 
                    VALUES (?, 'Стукіт у підвісці, заміна масла', 'В роботі', '2024-05-20', 1550)`, [vehicleId]);
            
            console.log("База успішно наповнена тестовими даними!");
        });
    });
});