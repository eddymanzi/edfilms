const express = require('express');
const router = express.Router();
const MovieService = require('../services/movieService');
const { authenticateAdmin } = require('../middleware/auth');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const stats = await MovieService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

// Legacy alias kept for compatibility
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await MovieService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;