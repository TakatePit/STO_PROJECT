/**
 * @file Прикладна помилка API з кодом для логів і ключем для локалізації.
 * @module errors/AppError
 */

class AppError extends Error {
    /**
     * @param {string} code Унікальний код типу (наприклад STO_DB).
     * @param {number} statusCode HTTP.
     * @param {string} messageKey Ключ у locales/*.json.
     * @param {object} [opts]
     * @param {Record<string, unknown>} [opts.context] Контекст для логів (без PII у проді).
     * @param {string} [opts.fallbackMessage] Текст, якщо ключ не знайдено.
     */
    constructor(code, statusCode, messageKey, opts = {}) {
        super(messageKey);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.messageKey = messageKey;
        this.context = opts.context || {};
        this.fallbackMessage = opts.fallbackMessage;
        this.errorId = null;
    }
}

module.exports = { AppError };
