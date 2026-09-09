const express = require('express');
const router = express.Router();
const SettingsService = require('../services/settingsService');
const PaymentService = require('../services/paymentService');
const { authenticateAdmin } = require('../middleware/auth');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const settings = await SettingsService.getAll();
    settings.payment = {
      provider: process.env.PAYMENT_PROVIDER || 'momo',
      mode: process.env.PAYMENT_MODE || 'live',
      currency: process.env.PAYMENT_CURRENCY || 'RWF',
      configured: PaymentService.providerIsConfigured(),
      mock: process.env.PAYMENT_MODE === 'mock'
    };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.put('/', authenticateAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.payment;
    await SettingsService.setMultiple(body);
    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;