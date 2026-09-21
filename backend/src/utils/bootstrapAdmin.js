const { query } = require('../config/database');
const AdminService = require('../services/adminService');

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;

  if (!username || !password) {
    return null;
  }

  const existing = await query('SELECT id FROM admins WHERE username = $1', [username]);

  if (existing.rows.length === 0) {
    const admin = await AdminService.createAdmin(username, password, email);
    console.log(`[bootstrap] Created admin account: "${admin.username}"`);
    return { username: admin.username, created: true };
  }

  const adminId = existing.rows[0].id;
  await AdminService.setAdminPassword(adminId, password);
  await AdminService.setAdminEmail(adminId, email || null);
  console.log(`[bootstrap] Synced credentials for admin: "${username}"`);
  return { username, synced: true };
}

module.exports = { bootstrapAdmin };