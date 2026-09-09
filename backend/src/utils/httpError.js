const { isProduction } = require('../config/env');

function serverErrorMessage(err) {
  console.error('[server-error]', err);
  return isProduction() ? 'Internal server error' : (err && err.message) || 'Internal server error';
}

module.exports = { serverErrorMessage };