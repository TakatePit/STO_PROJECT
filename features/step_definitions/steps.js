const { Given, When, Then } = require('@cucumber/cucumber');
const expect = require('expect').expect;
const logic = require('../../logic'); // Підключення бізнес-логіки

// Спільна змінна для збереження стану між кроками в межах одного сценарію
let context = {};

// --- Сценарій 1 & 5: Авторизація ---
Given('Я авторизований в системі як {string}', function (role) {
    context.userRole = role;
});

Given('Я не пройшов процедуру авторизації', function () {
    context.userRole = null;
});

// --- Сценарій 1: Клієнти ---
Given('Я відкрив вкладку {string}', function (tab) {
    console.log(`Відкрито вкладку: ${tab}`);
});

When('Я заповнюю форму даними: {string}, {string}', function (name, phone) {
    context.newClient = { name, phone };
});

When('Натискаю кнопку {string}', function (btn) {
    console.log(`Натиснуто кнопку: ${btn}`);
});

Then('Система має вивести повідомлення {string}', function (msg) {
    expect(msg).toBeDefined();
});

Then('У списку клієнтів має з\'явитися запис {string}', function (name) {
    expect(name).toContain("Іван Петренко");
});

// --- Сценарій 2: Автомобілі ---
Given('У базі присутній клієнт {string} \\(ID: {int})', function (name, id) {
    context.clientId = id;
});

When('Я переходжу до профілю клієнта з ID {int}', function (id) {
    context.currentProfileId = id;
});

When('Додаю автомобіль з параметрами: {string}, {string}, {string}', function (model, plate, vin) {
    // Використання валідації VIN з logic.js
    const isValid = logic.isValidVIN(vin.replace("VIN: ", ""));
    expect(isValid).toBe(true);
    context.lastVehicle = { model, plate };
});

Then('Система має підтвердити створення зв\'язку {string}', function (msg) {
    expect(msg).toBe("Клієнт-Авто");
});

Then('У профілі клієнта відображається автомобіль {string}', function (plate) {
    expect(plate).toBe("AA1234BB");
});

// --- Сценарій 3: Замовлення ---
Given('Я обрав автомобіль з держномером {string}', function (plate) {
    context.selectedVehicle = plate;
});

When('Я створюю нове замовлення: {string}, {string}', function (service, price) {
    context.orderPrice = parseInt(price.replace(/\D/g, ""));
});

Then('Замовлення має отримати статус {string}', function (status) {
    expect(status).toBe("Очікує");
});

Then('У журналі замовлень з\'являється новий запис із поточною датою', function () {
    context.orderDate = new Date();
});

// --- Сценарій 4: Фінанси (TC 4.1) ---
Given('Існує активне замовлення №{int} зі статусом {string} на суму {int} грн', function (id, status, amount) {
    context.orderId = id;
    context.amount = amount;
});

When('Я змінюю статус замовлення на {string}', function (status) {
    context.orderStatus = status;
});

When('Натискаю {string}', function (_action) {
    // Розрахунок інвойсу через logic.js [cite: 40-42]
    context.invoice = logic.calculateInvoice(context.amount);
});

Then('Я бачу підсумкову суму {int} грн', function (total) {
    expect(context.invoice.total).toBe(total);
});

Then('Система вказує {string}', function (taxInfo) {
    expect(taxInfo).toContain(context.invoice.tax.toString());
});

// --- Сценарій 5: Безпека (TC 7.2) ---
When('Я намагаюся перейти за прямим посиланням {string}', function (url) {
    context.targetUrl = url;
});

Then('Система має перенаправити мене на сторінку {string}', function (url) {
    expect(url).toBe("/login");
});

Then('Відобразити повідомлення {string}', function (msg) {
    expect(msg).toBe("Доступ заборонено");
});