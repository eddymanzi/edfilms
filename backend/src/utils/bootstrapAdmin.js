const { query } = require('../config/database');
const AdminService = require('../services/adminService');

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;

  if (!username || !password) {
    return null;
  }

  const existing = await query('SELECT id, email FROM admins WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    if (email && !existing.rows[0].email) {
      await AdminService.setAdminEmail(existing.rows[0].id, email);
      console.log(`[bootstrap] Set email for admin "${username}"`);
    }
    return { username, alreadyExists: true };
  }

  const admin = await AdminService.createAdmin(username, password, email);
  console.log(`[bootstrap] Created admin account: "${admin.username}"`);
  return { username: admin.username, created: true };
}

module.exports = { bootstrapAdmin };