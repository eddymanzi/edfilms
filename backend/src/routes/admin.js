const express = require('express');
const router = express.Router();
const AdminService = require('../services/adminService');
const { requestPasswordReset, resetPassword } = require('../services/passwordResetService');
const { authenticateAdmin } = require('../middleware/auth');
const { serverErrorMessage } = require('../utils/httpError');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = await AdminService.login(username, password);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.cookie('adminToken', admin.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ id: admin.id, username: admin.username, token: admin.token });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticateAdmin, (req, res) => {
  res.json(req.admin);
});

router.post('/forgot-password', async (req, res) => {
  try {
    const result = await requestPasswordReset(req.body?.email);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status !== 500) {
      return res.status(status).json({ error: error.message });
    }
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const result = await resetPassword(req.body?.token, req.body?.newPassword);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status !== 500) {
      return res.status(status).json({ error: error.message });
    }
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;