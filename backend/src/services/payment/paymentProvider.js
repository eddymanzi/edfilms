const crypto = require('crypto');

class PaymentProvider {
  constructor(config = {}) {
    this.config = config || {};
    this.name = 'base';
  }

  isConfigured() {
    return false;
  }

  getCurrency() {
    return this.config.currency || 'RWF';
  }

  generateReferenceId() {
    return crypto.randomUUID();
  }

  async initiatePayment(payload) {
    throw new Error(`Payment provider "${this.name}" does not support initiatePayment`);
  }

  async checkPaymentStatus(referenceId) {
    throw new Error(`Payment provider "${this.name}" does not support checkPaymentStatus`);
  }

  verifyCallback(callbackBody, headers = {}) {
    throw new Error(`Payment provider "${this.name}" does not support verifyCallback`);
  }

  normalizeStatus(status) {
    return String(status || '').toUpperCase();
  }
}

module.exports = PaymentProvider;