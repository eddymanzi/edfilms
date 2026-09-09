const express = require('express');
const router = express.Router();
const PaymentService = require('../services/paymentService');
const { authenticateAdmin } = require('../middleware/auth');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const status = req.query.status;
    const result = await PaymentService.listPayments({
      page: parseInt(req.query.page, 10) || 1,
      limit: Math.min(parseInt(req.query.limit, 10) || 20, 100),
      status: typeof status === 'string' ? status : 'ALL'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;