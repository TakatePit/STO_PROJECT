/**
 * Точка входу для production через npm (`npm run start:prod`).
 * Встановлює NODE_ENV до завантаження server.js.
 */
process.env.NODE_ENV = 'production';
require('../../server.js');
