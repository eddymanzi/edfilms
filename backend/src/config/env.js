function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function requireEnv(name, { minLength = 0 } = {}) {
  const value = process.env[name];
  if (value === undefined || value === '' || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (minLength > 0 && String(value).length < minLength) {
    throw new Error(`Environment variable ${name} must be at least ${minLength} characters`);
  }
  return value;
}

function validateEnv() {
  if (!isProduction()) return;

  requireEnv('DATABASE_URL');
  requireEnv('JWT_SECRET', { minLength: 32 });
  requireEnv('FRONTEND_URL');
  requireEnv('CORS_ORIGINS');

  const paymentMode = (process.env.PAYMENT_MODE || 'live').toLowerCase();
  if (paymentMode === 'live') {
    requireEnv('MOMO_API_BASE_URL');
    requireEnv('MOMO_API_KEY');
    requireEnv('MOMO_API_SECRET');
    requireEnv('MOMO_SUBSCRIPTION_KEY');
    requireEnv('MOMO_TARGET_ENVIRONMENT');
    requireEnv('MOMO_CALLBACK_URL');
  }

  console.log('[env] Production environment validated OK');
}

module.exports = { validateEnv, requireEnv, isProduction };