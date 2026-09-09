const express = require('express');
const router = express.Router();
const MessageService = require('../services/messageService');
const { authenticateAdmin } = require('../middleware/auth');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await MessageService.getAll({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      resolved: req.query.resolved !== undefined ? parseInt(req.query.resolved) : undefined
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const message = await MessageService.markResolved(parseInt(req.params.id));
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await MessageService.delete(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;