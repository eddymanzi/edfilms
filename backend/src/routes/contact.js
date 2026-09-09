const express = require('express');
const router = express.Router();
const MessageService = require('../services/messageService');
const { serverErrorMessage } = require('../utils/httpError');

router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Name too long' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long' });
    }

    const saved = await MessageService.create(name, email, message);
    res.status(201).json({ message: 'Message sent successfully', data: saved });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;