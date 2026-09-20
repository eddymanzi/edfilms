const { query } = require('../config/database');
const AdminService = require('../services/adminService');

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  const existing = await query('SELECT id FROM admins WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    return { username, alreadyExists: true };
  }

  const admin = await AdminService.createAdmin(username, password);
  console.log(`[bootstrap] Created admin account: "${admin.username}"`);
  return { username: admin.username, created: true };
}

module.exports = { bootstrapAdmin };