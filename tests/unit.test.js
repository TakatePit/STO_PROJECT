const logic = require('../logic');

describe('UNIT: Тестування бізнес-логіки СТО', () => {
    
    test('1. calculateInvoice: має нараховувати 5% ПДВ', () => {
        const res = logic.calculateInvoice(2000);
        expect(res.tax).toBe(100);
        expect(res.total).toBe(2100);
    });

    test('2. isValidVIN: має приймати лише 17-значні коди', () => {
        expect(logic.isValidVIN("12345678901234567")).toBe(true);
        expect(logic.isValidVIN("ABC123")).toBe(false);
        expect(logic.isValidVIN(null)).toBe(false); // Перевірка типу даних
    });

    test('3. applyDiscount: знижка 10% лише при сумі понад 5000', () => {
        expect(logic.applyDiscount(6000)).toBe(5400);
        expect(logic.applyDiscount(5000)).toBe(5000); // Межове значення
        expect(logic.applyDiscount(1000)).toBe(1000);
    });

    test('4. formatPlate: має видаляти пробіли та робити літери великими', () => {
        expect(logic.formatPlate("aa-7777 bb")).toBe("AA7777BB");
        expect(logic.formatPlate("   ")).toBe(""); // Крайній випадок
    });

    test('5. getStatusColor: коректна колірна індикація статусів', () => {
        expect(logic.getStatusColor("Завершено")).toBe("green");
        expect(logic.getStatusColor("Очікує")).toBe("red");
    });

    // --- НОВІ ТЕСТИ ДЛЯ 100% ПОКРИТТЯ ---

    test('6. getStatusColor: має повертати yellow для будь-якого іншого статусу (ПОКРИТТЯ РЯДКА 22)', () => {
        // Це саме той випадок "return yellow", який у вас був Uncovered
        expect(logic.getStatusColor("У роботі")).toBe("yellow");
        expect(logic.getStatusColor("Прийнято")).toBe("yellow");
        expect(logic.getStatusColor("Скасовано")).toBe("yellow");
    });

    test('7. calculateInvoice: коректно обробляє нульову суму', () => {
        const res = logic.calculateInvoice(0);
        expect(res.total).toBe(0);
        expect(res.tax).toBe(0);
    });

    test('8. formatPlate: обробляє некоректні вхідні дані (захист)', () => {
        // Якщо ви додали typeof перевірку в logic.js
        expect(logic.formatPlate("bc 1234-aa")).toBe("BC1234AA");
    });
});