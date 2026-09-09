const PaymentProvider = require('./paymentProvider');

class MockProvider extends PaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'mock';
    this.mode = 'mock';
    this.currency = config.currency || 'RWF';
    this._transactions = new Map();
    this._failurePhoneNumbers = new Set((config.mockFailurePhones || '').split(',').map(s => s.trim()).filter(Boolean));
  }

  isConfigured() {
    return true;
  }

  configSummary() {
    return {
      name: this.name,
      mode: 'mock',
      configured: true,
      currency: this.currency,
      note: 'MOCK MODE - for local development only. Never present as real payment.'
    };
  }

  async initiatePayment({ amount, currency, phoneNumber, referenceId, reason = '' }) {
    const providerTransactionId = this.generateReferenceId();
    const autoSettleAt = Date.now() + (this.config.mockSettleSeconds || 6) * 1000;

    this._transactions.set(providerTransactionId, {
      providerTransactionId,
      referenceId,
      amount,
      currency: currency || this.currency,
      phoneNumber,
      status: 'PENDING',
      autoSettleAt,
      settled: null
    });

    return {
      provider: this.name,
      providerTransactionId,
      referenceId,
      raw: { statusCode: 202 }
    };
  }

  async checkPaymentStatus(referenceId) {
    const txn = this._transactions.get(referenceId);

    if (!txn) {
      return { provider: this.name, referenceId, rawStatus: 'PENDING', status: 'PENDING', raw: {} };
    }

    let status = txn.status;

    if (status === 'PENDING' && this._failurePhoneNumbers.has(txn.phoneNumber)) {
      status = 'FAILED';
      txn.status = status;
      txn.settled = Date.now();
    } else if (status === 'PENDING' && Date.now() >= txn.autoSettleAt) {
      status = 'SUCCESS';
      txn.status = status;
      txn.settled = Date.now();
    }

    return {
      provider: this.name,
      referenceId,
      rawStatus: status,
      status,
      amount: txn.amount,
      currency: txn.currency,
      payerNumber: txn.phoneNumber,
      transactionId: referenceId,
      raw: { status }
    };
  }

  verifyCallback(callbackBody) {
    const body = callbackBody || {};
    const referenceId = body.referenceId || body.providerTransactionId;
    if (!referenceId) {
      return { valid: false, reason: 'Missing reference id' };
    }

    const txn = this._transactions.get(referenceId);
    if (!txn) {
      return { valid: false, reason: 'Unknown reference id' };
    }

    const status = this.normalizeStatus(body.status || 'PENDING');
    return {
      valid: true,
      referenceId,
      status,
      amount: body.amount || txn.amount,
      currency: body.currency || txn.currency,
      transactionId: referenceId,
      raw: body
    };
  }

  normalizeStatus(status) {
    return String(status || 'PENDING').toUpperCase();
  }
}

module.exports = MockProvider;