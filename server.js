const { logger } = require('./logger');
const app = require('./backend/src/app');

const APP_PORT = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV !== 'test') {
  app.listen(APP_PORT, () => {
    logger.info('CarFlow працює', { url: `http://localhost:${APP_PORT}`, port: APP_PORT });
  });
}

module.exports = app;
