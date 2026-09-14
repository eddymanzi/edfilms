const MomoProvider = require('./momoProvider');
const MockProvider = require('./mockProvider');

function createPaymentProvider(env = process.env) {
  const providerName = (env.PAYMENT_PROVIDER || 'momo').toLowerCase();
  const mode = (env.PAYMENT_MODE || 'live').toLowerCase();

  if (mode === 'mock') {
    console.warn('[payment] ⚠️ MOCK PAYMENT MODE ENABLED. For local development only. Never use in production.');
    return new MockProvider({
      currency: env.PAYMENT_CURRENCY || 'RWF',
      mockSettleSeconds: env.MOCK_SETTLE_SECONDS || '6',
      mockFailurePhones: env.MOCK_FAILURE_PHONES || ''
    });
  }

  if (providerName === 'momo') {
    return new MomoProvider({
      mode,
      apiBaseUrl: env.MOMO_API_BASE_URL,
      apiKey: env.MOMO_API_KEY,
      apiSecret: env.MOMO_API_SECRET,
      subscriptionKey: env.MOMO_SUBSCRIPTION_KEY,
      targetEnvironment: env.MOMO_TARGET_ENVIRONMENT,
      receivingMsisdn: env.MOMO_RECEIVING_MSISDN || '',
      currency: env.PAYMENT_CURRENCY || 'RWF'
    });
  }

  throw new Error(`Unknown payment provider: ${providerName}`);
}

module.exports = { createPaymentProvider, MomoProvider, MockProvider };