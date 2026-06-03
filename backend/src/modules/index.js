const { Router } = require('express');
const { registerAuthModule } = require('./auth/routes');
const { registerCrmModule } = require('./crm/routes');
const { registerOrdersModule } = require('./orders/routes');
const { registerAppointmentsModule } = require('./appointments/routes');
const { registerAdminModule } = require('./admin/routes');

function registerModules(app) {
  const api = Router();
  registerAuthModule(api);
  registerAdminModule(api);
  registerCrmModule(api);
  registerOrdersModule(api);
  registerAppointmentsModule(api);

  app.use('/api', api);
}

module.exports = { registerModules };
