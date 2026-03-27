/**
 * Допоміжні функції для експериментів або старих тестів (спрощені копії правил з `logic.js`).
 * Основний модуль домену проєкту — {@link module:logic `../logic.js`}.
 * @module tests/logic
 */

/**
 * @typedef {object} TestInvoice
 * @property {number} subtotal Базова сума без податку.
 * @property {number} tax Податок 5%.
 * @property {number} total Сума з податком.
 */

/**
 * Спрощений розрахунок чека з податком 5% (без захисту від від’ємних сум).
 * @param {number} sum Базова сума.
 * @returns {TestInvoice} Інвойс із податком 5%.
 */
const calculateInvoice = (sum) => ({
    subtotal: sum,
    tax: sum * 0.05,
    total: sum * 1.05,
});

/**
 * @param {unknown} vin Можливий VIN з форми.
 * @returns {boolean} `true`, якщо непустий рядок довжиною 17.
 */
const isValidVIN = (vin) => Boolean(typeof vin === 'string' && vin.length === 17);

/**
 * @param {number} sum Сума до знижки.
 * @returns {number} Сума після знижки 10% або без зміни.
 */
const applyDiscount = (sum) => (sum > 5000 ? sum * 0.9 : sum);

module.exports = { calculateInvoice, isValidVIN, applyDiscount };
