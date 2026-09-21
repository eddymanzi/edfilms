const { query } = require('../config/database');
const AdminService = require('../services/adminService');

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const envPassword = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL || 'kimozera1@gmail.com';

  const existing = await query('SELECT id FROM admins WHERE username = $1', [username]);

  if (existing.rows.length === 0) {
    const password = envPassword || 'admin123';
    const admin = await AdminService.createAdmin(username, password, email);
    console.log(
      envPassword
        ? `[bootstrap] Created admin account: "${admin.username}"`
        : `[bootstrap] Created admin account: "${admin.username}" with DEFAULT password. Set ADMIN_PASSWORD env and restart to change it.`
    );
    return { username, created: true };
  }

  if (envPassword) {
    await AdminService.setAdminPassword(existing.rows[0].id, envPassword);
    await AdminService.setAdminEmail(existing.rows[0].id, email);
    console.log(`[bootstrap] Synced admin credentials from env: "${username}"`);
    return { username, synced: true };
  }

  return { username, alreadyExists: true };
}

module.exports = { bootstrapAdmin };