const PaymentProvider = require('./paymentProvider');

class MomoProvider extends PaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'momo';
    this.mode = config.mode || config.paymentMode || 'live';
    this.apiBaseUrl = (config.apiBaseUrl || '').replace(/\/$/, '');
    this.apiKey = config.apiKey || '';
    this.apiSecret = config.apiSecret || '';
    this.subscriptionKey = config.subscriptionKey || '';
    this.targetEnvironment = config.targetEnvironment || '';
    this.currency = config.currency || 'RWF';
  }

  isConfigured() {
    return Boolean(
      this.apiBaseUrl &&
      this.apiKey &&
      this.apiSecret &&
      this.subscriptionKey &&
      this.targetEnvironment
    );
  }

  configSummary() {
    return {
      name: this.name,
      mode: this.mode,
      configured: this.isConfigured(),
      currency: this.currency
    };
  }

  async _getAccessToken() {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

    const response = await fetch(`${this.apiBaseUrl}/collection/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Length': '0'
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return data.access_token;
    }

    throw this._providerError('TOKEN_FAILED', `MoMo token request failed (${response.status})`);
  }

  async initiatePayment({ amount, currency, phoneNumber, referenceId, reason = '' }) {
    if (!this.isConfigured()) {
      throw this._providerError('PROVIDER_NOT_CONFIGURED', 'MoMo provider is not configured');
    }

    const accessToken = await this._getAccessToken();
    const transactionReference = this.generateReferenceId();

    const payerNumber = String(phoneNumber || '').replace(/^0/, '250');

    const body = {
      amount: String(amount),
      currency: currency || this.currency,
      externalId: referenceId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: payerNumber
      },
      payerMessage: 'EdFilms movie access payment',
      payeeNote: reason || 'EdFilms movie payment'
    };

    const response = await fetch(`${this.apiBaseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Reference-Id': transactionReference,
        'X-Target-Environment': this.targetEnvironment,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.status !== 202) {
      const errorText = await response.text();
      throw this._providerError('INITIATE_FAILED', `MoMo request-to-pay failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    return {
      provider: this.name,
      providerTransactionId: transactionReference,
      referenceId: transactionReference,
      raw: { statusCode: response.status }
    };
  }

  async checkPaymentStatus(referenceId) {
    if (!this.isConfigured()) {
      throw this._providerError('PROVIDER_NOT_CONFIGURED', 'MoMo provider is not configured');
    }

    const accessToken = await this._getAccessToken();

    const response = await fetch(`${this.apiBaseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Target-Environment': this.targetEnvironment,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return {
        provider: this.name,
        referenceId,
        rawStatus: data.status,
        status: this.normalizeStatus(data.status),
        amount: data.amount,
        currency: data.currency,
        payerNumber: data.payer?.partyId,
        transactionId: data.transactionId || referenceId,
        raw: data
      };
    }

    if (response.status === 404) {
      return {
        provider: this.name,
        referenceId,
        rawStatus: 'PENDING',
        status: 'PENDING',
        raw: {}
      };
    }

    throw this._providerError('STATUS_FAILED', `MoMo status request failed (${response.status})`);
  }

  verifyCallback(callbackBody, headers = {}) {
    const body = callbackBody || {};

    if (this.mode === 'mock') {
      return { valid: true, ...body };
    }

    const referenceId = body.referenceId || body['X-Reference-Id'] || headers['x-reference-id'];
    if (!referenceId) {
      return { valid: false, reason: 'Missing reference id' };
    }

    const status = this.normalizeStatus(body.status || body.transactionStatus || '');
    if (!['SUCCESSFUL', 'PENDING', 'FAILED', 'SUCCESS'].includes(status)) {
      return { valid: false, reason: `Unrecognized status: ${status}` };
    }

    return {
      valid: true,
      referenceId,
      status,
      amount: body.amount,
      currency: body.currency,
      transactionId: body.transactionId || body.id || referenceId,
      raw: body
    };
  }

  normalizeStatus(status) {
    const map = {
      'SUCCESSFUL': 'SUCCESS',
      'SUCCESS': 'SUCCESS',
      'PENDING': 'PENDING',
      'FAILED': 'FAILED',
      'REJECTED': 'FAILED',
      'TIMEOUT': 'FAILED',
      'CANCELLED': 'CANCELLED',
      'EXPIRED': 'EXPIRED'
    };
    return map[String(status || '').toUpperCase()] || 'PENDING';
  }

  _providerError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.provider = this.name;
    return error;
  }
}

module.exports = MomoProvider;