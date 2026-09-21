const crypto = require('crypto');
const { query } = require('../config/database');
const AdminService = require('./adminService');
const { sendMail } = require('./mailService');

const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

async function requestPasswordReset(emailInput) {
  const email = String(emailInput || '').trim().toLowerCase();
  if (!email) {
    throw badRequest('Email is required');
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const admin = await AdminService.getAdminByEmail(email);

  if (admin) {
    await query('DELETE FROM admin_reset_tokens WHERE "adminId" = $1', [admin.id]);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await query(
      'INSERT INTO admin_reset_tokens ("adminId", token_hash, expires_at) VALUES ($1, $2, $3)',
      [admin.id, hashToken(token), expiresAt]
    );

    const resetUrl = `${frontendUrl}/admin/reset-password?token=${token}`;

    await sendMail({
      to: admin.email,
      subject: 'EdFilms Admin password reset',
      text: `Someone requested a password reset for your EdFilms admin account.\n\nOpen this link within 30 minutes to choose a new password:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:8px;">
          <h2 style="margin-top:0;">EdFilms Admin</h2>
          <p>Someone requested a password reset for your admin account.</p>
          <p>Open this link within <strong>30 minutes</strong> to choose a new password:</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="background:#6c5ce7;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;">Reset password</a>
          </p>
          <p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p>
        </div>`
    });
  }

  return { message: 'If an account with that email exists, a reset link has been sent.' };
}

async function resetPassword(token, newPassword) {
  if (!token) {
    throw badRequest('Reset token is required');
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw badRequest('New password must be at least 6 characters');
  }

  const tokenHash = hashToken(token);
  const result = await query(
    'SELECT id, "adminId", used, expires_at FROM admin_reset_tokens WHERE token_hash = $1',
    [tokenHash]
  );
  const row = result.rows[0];

  if (!row || row.used === 1 || new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest('Invalid or expired reset link');
  }

  await AdminService.setAdminPassword(row.adminId, newPassword);
  await query('UPDATE admin_reset_tokens SET used = 1 WHERE id = $1', [row.id]);
  await query('DELETE FROM admin_reset_tokens WHERE "adminId" = $1 AND id != $2', [row.adminId, row.id]);

  return { message: 'Password updated. You can now log in.' };
}

module.exports = { requestPasswordReset, resetPassword };