const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const { createRateLimiter } = require('../utils/rateLimiter');

const initiateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: 'pay-init' });
const callbackLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60, keyPrefix: 'pay-callback' });

router.post('/initiate', initiateLimiter, async (req, res) => {
  try {
    const { movieId, customerReference, phoneNumber } = req.body || {};

    if (!movieId) {
      return res.status(400).json({ success: false, error: { code: 'MOVIE_ID_REQUIRED', message: 'movieId is required' } });
    }

    const payment = await PaymentService.initiate({
      movieId,
      customerReference,
      phoneNumber
    });

    res.status(201).json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        amountRwf: payment.amount_rwf,
        currency: payment.currency,
        provider: payment.provider,
        createdAt: payment.created_at
      }
    });
  } catch (error) {
    const statusMap = {
      INVALID_CUSTOMER_REFERENCE: 400,
      INVALID_PHONE: 400,
      MOVIE_NOT_FOUND: 404,
      MOVIE_NOT_PUBLISHED: 403,
      MOVIE_IS_FREE: 400,
      INVALID_AMOUNT: 400,
      PROVIDER_NOT_CONFIGURED: 503,
      INITIATE_FAILED: 502,
      TOKEN_FAILED: 502
    };
    const status = statusMap[error.code] || 500;
    const message = error.message || 'Failed to initiate payment';
    // never leak provider internals
    if (status === 502 || status === 503) {
      res.status(status).json({
        success: false,
        error: { code: error.code || 'PAYMENT_PROVIDER_ERROR', message: 'Payment provider is currently unavailable. Please try again later.' }
      });
    } else {
      res.status(status).json({ success: false, error: { code: error.code || 'PAYMENT_ERROR', message } });
    }
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    let payment = await PaymentService.getById(id);
    if (!payment) {
      const error = new Error('Payment not found');
      error.code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    if (payment.status === 'PENDING') {
      try {
        payment = await PaymentService.verifyAndSettle(id);
      } catch {
        payment = await PaymentService.getById(id);
      }
    }

    res.json({ success: true, data: await PaymentService.getStatus(id) });
  } catch (error) {
    const status = error.code === 'PAYMENT_NOT_FOUND' ? 404 : 500;
    res.status(status).json({ success: false, error: { code: error.code || 'PAYMENT_ERROR', message: error.message } });
  }
});

router.post('/momo/callback', callbackLimiter, async (req, res) => {
  try {
    const result = await PaymentService.handleMoMoCallback(req.body || {}, req.headers || {});

    if (!result.valid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CALLBACK', message: result.reason || 'Invalid callback' } });
    }

    res.status(200).json({ success: true, data: { status: result.payment.status } });
  } catch (error) {
    if (error.code === 'DUPLICATE_TRANSACTION') {
      return res.status(200).json({ success: true, data: { status: 'ALREADY_PROCESSED' } });
    }
    res.status(500).json({ success: false, error: { code: 'CALLBACK_ERROR', message: 'Failed to process callback' } });
  }
});

module.exports = router;