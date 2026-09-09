const { query, getDb } = require('../config/database');
const MovieService = require('./movieService');
const crypto = require('crypto');

const ACCESS_TYPES = ['FREE', 'WATCH_FREE_DOWNLOAD_PAID', 'PREMIUM'];
const DOWNLOAD_ACCESS = ['FREE', 'PAID'];
const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'];
const CURRENCY_RWF = 'RWF';

function generateCustomerReference() {
  return `edfilms_${crypto.randomBytes(16).toString('hex')}`;
}

function isValidCustomerReference(ref) {
  return typeof ref === 'string' && /^edfilms_[a-f0-9]{32}$/.test(ref);
}

function isValidPhoneNumber(phone) {
  return typeof phone === 'string' && /^07[0-9]{8}$/.test(phone);
}

class PaymentService {
  static VALID_STATUSES = PAYMENT_STATUSES;
  static VALID_ACCESS_TYPES = ACCESS_TYPES;
  static VALID_DOWNLOAD_ACCESS = DOWNLOAD_ACCESS;

  static _provider = null;

  static createProvider() {
    if (!this._provider) {
      const { createPaymentProvider } = require('./payment');
      this._provider = createPaymentProvider();
    }
    return this._provider;
  }

  static providerIsConfigured() {
    try {
      return this.createProvider().isConfigured();
    } catch {
      return false;
    }
  }

  static providerSummary() {
    try {
      return this.createProvider().configSummary();
    } catch (error) {
      return { name: (process.env.PAYMENT_PROVIDER || 'momo'), configured: false };
    }
  }

  static resolveAccessTypes(movie) {
    if (!movie) return null;

    let accessType = movie.access_type || 'FREE';
    let downloadAccess = movie.download_access || 'FREE';
    let priceRwf = movie.price_rwf || 0;

    if (accessType === 'PREMIUM') {
      downloadAccess = 'PAID';
    } else if (accessType === 'WATCH_FREE_DOWNLOAD_PAID') {
      downloadAccess = 'PAID';
    } else {
      if (movie.allowDownload !== undefined && !movie.allowDownload) {
        downloadAccess = 'PAID';
      }
    }

    return { accessType, downloadAccess, priceRwf };
  }

  static requiresWatchPayment(movie) {
    const resolved = this.resolveAccessTypes(movie);
    return resolved.accessType === 'PREMIUM';
  }

  static requiresDownloadPayment(movie) {
    const resolved = this.resolveAccessTypes(movie);
    return resolved.downloadAccess === 'PAID';
  }

  static isFreeMovie(movie) {
    return movie.access_type === 'FREE' || !movie.access_type;
  }

  static async hasEntitlement(movieId, customerReference, accessType) {
    if (!customerReference) return false;

    const result = await query(`
      SELECT id FROM movie_entitlements
      WHERE movie_id = $1 AND customer_reference = $2 AND access_type = $3
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      LIMIT 1
    `, [movieId, customerReference, accessType]);

    return result.rows.length > 0;
  }

  static async canWatch(movie, customerReference) {
    if (this.isFreeMovie(movie)) return true;
    if (movie.access_type === 'WATCH_FREE_DOWNLOAD_PAID') return true;
    return this.hasEntitlement(movie.id, customerReference, 'watch');
  }

  static async canDownload(movie, customerReference) {
    const resolved = this.resolveAccessTypes(movie);
    if (resolved.downloadAccess === 'FREE') return true;
    return this.hasEntitlement(movie.id, customerReference, 'download');
  }

  static async initiate({ movieId, customerReference, phoneNumber }) {
    if (!isValidCustomerReference(customerReference)) {
      const error = new Error('Invalid customer reference');
      error.code = 'INVALID_CUSTOMER_REFERENCE';
      throw error;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      const error = new Error('Invalid phone number. Use Rwandan format: 07XXXXXXXX');
      error.code = 'INVALID_PHONE';
      throw error;
    }

    const movie = await MovieService.getById(parseInt(movieId, 10));
    if (!movie) {
      const error = new Error('Movie not found');
      error.code = 'MOVIE_NOT_FOUND';
      throw error;
    }
    if (!movie.published) {
      const error = new Error('Movie is not available for purchase');
      error.code = 'MOVIE_NOT_PUBLISHED';
      throw error;
    }

    const resolved = this.resolveAccessTypes(movie);
    if (resolved.accessType === 'FREE' && resolved.downloadAccess === 'FREE') {
      const error = new Error('This movie is free. No payment is required.');
      error.code = 'MOVIE_IS_FREE';
      throw error;
    }

    const amountRwf = parseInt(movie.price_rwf, 10) || 0;
    if (amountRwf <= 0) {
      const error = new Error('Movie price is not configured');
      error.code = 'INVALID_AMOUNT';
      throw error;
    }

    const provider = this.createProvider();
    if (this.providerIsConfigured() === false && process.env.PAYMENT_MODE !== 'mock') {
      const error = new Error('Payment provider is not configured');
      error.code = 'PROVIDER_NOT_CONFIGURED';
      throw error;
    }

    const paymentReference = `pay_${crypto.randomBytes(12).toString('hex')}`;
    const providerResponse = await provider.initiatePayment({
      amount: amountRwf,
      currency: CURRENCY_RWF,
      phoneNumber,
      referenceId: paymentReference,
      reason: `EdFilms access to ${movie.title}`
    });

    const providerTransactionId = providerResponse.providerTransactionId || paymentReference;

    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`
        INSERT INTO payments
          (movie_id, customer_reference, phone_number, amount_rwf, currency, provider, provider_transaction_id, status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
        RETURNING id
      `, [
        movie.id,
        customerReference,
        phoneNumber,
        amountRwf,
        CURRENCY_RWF,
        providerResponse.provider || provider.name,
        providerTransactionId,
        JSON.stringify({ ...(providerResponse.raw || {}), movieTitle: movie.title })
      ]);

      const payment = await client.query('SELECT * FROM payments WHERE id = $1', [result.rows[0].id]);
      await client.query('COMMIT');
      return payment.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getById(paymentId) {
    const result = await query(`
      SELECT p.*, m.title as movie_title, m.poster as movie_poster, m.slug as movie_slug
      FROM payments p
      LEFT JOIN movies m ON m.id = p.movie_id
      WHERE p.id = $1
    `, [parseInt(paymentId, 10)]);
    return result.rows[0] || null;
  }

  static async getByProviderTransactionId(transactionId) {
    const result = await query('SELECT * FROM payments WHERE provider_transaction_id = $1', [transactionId]);
    return result.rows[0] || null;
  }

  static async getStatus(paymentId) {
    const payment = await this.getById(paymentId);
    if (!payment) {
      const error = new Error('Payment not found');
      error.code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    const safe = { ...payment };
    return {
      id: safe.id,
      movieId: safe.movie_id,
      movieTitle: safe.movie_title,
      movieSlug: safe.movie_slug,
      customerReference: safe.customer_reference,
      amountRwf: safe.amount_rwf,
      currency: safe.currency,
      provider: safe.provider,
      providerTransactionId: safe.provider_transaction_id,
      status: safe.status,
      createdAt: safe.created_at,
      paidAt: safe.paid_at
    };
  }

  static async _createEntitlement(movieId, paymentId, customerReference, client) {
    const exec = client || getDb();
    const movie = await MovieService.getById(movieId);
    if (!movie) return null;

    const resolved = this.resolveAccessTypes(movie);
    const accessTypes = [];
    if (resolved.accessType === 'FREE' || resolved.accessType === 'WATCH_FREE_DOWNLOAD_PAID') {
      if (resolved.downloadAccess === 'PAID') accessTypes.push('download');
    } else if (resolved.accessType === 'PREMIUM') {
      accessTypes.push('watch');
      if (resolved.downloadAccess === 'PAID') accessTypes.push('download');
    }

    if (accessTypes.length === 0) return null;

    for (const accessType of accessTypes) {
      await exec.query(`
        INSERT INTO movie_entitlements (movie_id, payment_id, customer_reference, access_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (movie_id, customer_reference, access_type) DO NOTHING
      `, [movieId, paymentId, customerReference, accessType]);
    }

    const result = await exec.query(`
      SELECT * FROM movie_entitlements WHERE movie_id = $1 AND customer_reference = $2
    `, [movieId, customerReference]);
    return result.rows;
  }

  static async verifyAndSettle(paymentId, providerStatus = null) {
    const payment = await this.getById(paymentId);
    if (!payment) {
      const error = new Error('Payment not found');
      error.code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    if (payment.status !== 'PENDING') {
      return this.getById(paymentId);
    }

    const provider = this.createProvider();

    let status = providerStatus;
    let verifiedAmount = null;
    let verifiedCurrency = null;
    let providerTransactionId = payment.provider_transaction_id;

    if (!status) {
      const result = await provider.checkPaymentStatus(payment.provider_transaction_id);
      status = result.status;
      if (result.amount !== undefined && result.amount !== null) verifiedAmount = result.amount;
      if (result.currency !== undefined && result.currency !== null) verifiedCurrency = result.currency;
      if (result.transactionId) providerTransactionId = result.transactionId;
    }

    status = provider.normalizeStatus(status);

    if (!PAYMENT_STATUSES.includes(status)) {
      status = 'PENDING';
    }

    if (status === 'SUCCESS') {
      const expectedAmount = payment.amount_rwf;
      const expectedCurrency = payment.currency;

      if (verifiedAmount !== null) {
        if (parseFloat(verifiedAmount) !== parseFloat(expectedAmount)) {
          status = 'FAILED';
          const error = new Error(`Payment amount mismatch: expected ${expectedAmount} ${expectedCurrency}, got ${verifiedAmount} ${verifiedCurrency || expectedCurrency}`);
          error.code = 'AMOUNT_MISMATCH';
          await query(`UPDATE payments SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [payment.id]);
          throw error;
        }
      }

      if (verifiedCurrency !== null && verifiedCurrency !== expectedCurrency) {
        status = 'FAILED';
        const error = new Error(`Payment currency mismatch for payment ${payment.id}`);
        error.code = 'CURRENCY_MISMATCH';
        await query(`UPDATE payments SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [payment.id]);
        throw error;
      }
    }

    const client = await getDb().connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT id FROM payments WHERE provider_transaction_id = $1 AND id != $2',
        [providerTransactionId, payment.id]
      );
      if (existing.rows.length > 0 && status === 'SUCCESS') {
        const error = new Error('Duplicate successful transaction already processed for another payment');
        error.code = 'DUPLICATE_TRANSACTION';
        throw error;
      }

      if (status === 'SUCCESS') {
        await client.query(`
          UPDATE payments
          SET status = 'SUCCESS', provider_transaction_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [providerTransactionId, payment.id]);

        await this._createEntitlement(payment.movie_id, payment.id, payment.customer_reference, client);
      } else {
        await client.query(`
          UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [status, payment.id]);
      }

      await client.query('COMMIT');
      return this.getById(payment.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async handleMoMoCallback(callbackBody, headers = {}) {
    const provider = this.createProvider();
    const cb = provider.verifyCallback(callbackBody, headers);

    if (!cb.valid) {
      return { valid: false, reason: cb.reason };
    }

    const payment = await this.getByProviderTransactionId(cb.referenceId);
    if (!payment) {
      return { valid: false, reason: 'Unknown provider transaction reference', referenceId: cb.referenceId };
    }

    const settled = await this.verifyAndSettle(payment.id, cb.status);

    return { valid: true, payment: settled };
  }

  static async listPayments({ page = 1, limit = 20, status } = {}) {
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    let paramIndex = 1;

    if (status && status !== 'ALL') {
      where = `WHERE p.status = $${paramIndex++}`;
      params.push(status);
    }

    const totalResult = await query(`SELECT COUNT(*)::int as c FROM payments p ${where}`, params);
    const total = totalResult.rows[0].c;

    const paymentsResult = await query(`
      SELECT p.*, m.title as movie_title, m.slug as movie_slug
      FROM payments p
      LEFT JOIN movies m ON m.id = p.movie_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);

    return {
      payments: paymentsResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  static async getStats() {
    const sums = await query(`
      SELECT
        COUNT(*)::int as totalPayments,
        COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END), 0)::int as successfulPayments,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0)::int as pendingPayments,
        COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0)::int as failedPayments,
        COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0)::int as cancelledPayments,
        COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN amount_rwf ELSE 0 END), 0)::int as totalRevenueRwf
      FROM payments
    `);
    const sumsRow = sums.rows[0] || {};

    const paidDownloadsResult = await query(`SELECT COUNT(*)::int as c FROM movie_entitlements WHERE access_type = 'download'`);
    const paidUnlocksResult = await query(`SELECT COUNT(*)::int as c FROM movie_entitlements WHERE access_type = 'watch'`);

    return {
      totalPayments: sumsRow.totalPayments || 0,
      successfulPayments: sumsRow.successfulPayments || 0,
      pendingPayments: sumsRow.pendingPayments || 0,
      failedPayments: sumsRow.failedPayments || 0,
      cancelledPayments: sumsRow.cancelledPayments || 0,
      totalRevenueRwf: sumsRow.totalRevenueRwf || 0,
      paidDownloads: paidDownloadsResult.rows[0].c,
      paidUnlocks: paidUnlocksResult.rows[0].c
    };
  }
}

module.exports = PaymentService;
module.exports.generateCustomerReference = generateCustomerReference;
module.exports.isValidCustomerReference = isValidCustomerReference;
module.exports.isValidPhoneNumber = isValidPhoneNumber;