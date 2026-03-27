/**
 * Доменні функції СТО: гроші, VIN, держномери, відображення статусів.
 * Модуль без побічних ефектів — зручний для unit-тестів і Cucumber.
 * @module logic
 */

/**
 * @typedef {object} InvoiceBreakdown
 * @property {number} subtotal Базова сума (не менше 0).
 * @property {number} tax Податок 5% від subtotal.
 * @property {number} total Повна сума до сплати.
 */

const logic = {
    /**
     * Розраховує суми чека з податком 5%. Від'ємні суми трактуються як 0.
     * @param {number} sum Вхідна сума замовлення.
     * @returns {InvoiceBreakdown} Деталізація чека.
     */
    calculateInvoice: (sum) => {
        const amount = sum > 0 ? sum : 0;
        return {
            subtotal: amount,
            tax: amount * 0.05,
            total: amount * 1.05,
        };
    },

    /**
     * Перевіряє, чи рядок є валідним VIN (ISO 3779: рівно 17 символів).
     * @param {unknown} vin Довільне значення з форми/API.
     * @returns {boolean} `true`, якщо це рядок довжиною 17.
     */
    isValidVIN: (vin) => typeof vin === 'string' && vin.length === 17,

    /**
     * Знижка 10% на великі замовлення (сума строго більше 5000).
     * @param {number} sum Сума до знижки.
     * @returns {number} Сума з урахуванням знижки або без змін.
     */
    applyDiscount: (sum) => (sum > 5000 ? sum * 0.9 : sum),

    /**
     * Нормалізує держномер: прибирає пробіли та дефіси, upper case.
     * @param {unknown} p Рядок номера або не рядок.
     * @returns {string} Нормалізований номер або порожній рядок.
     */
    formatPlate: (p) => (typeof p === 'string' ? p.replace(/[\s-]/g, '').toUpperCase() : ''),

    /**
     * Колір індикатора статусу для UI (таблиця статусів).
     * @param {string} s Текстовий статус замовлення.
     * @returns {'green'|'red'|'yellow'} Код кольору.
     */
    getStatusColor: (s) => {
        if (s === 'Завершено') return 'green';
        if (s === 'Очікує') return 'red';
        return 'yellow';
    },
};

module.exports = logic;
