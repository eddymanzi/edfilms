const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'edfilms_fallback_secret';

class AdminService {
  static async login(usernameOrEmail, password) {
    const result = await query(
      'SELECT * FROM admins WHERE username = $1 OR LOWER(email) = $1',
      [String(usernameOrEmail || '').trim().toLowerCase()]
    );
    const admin = result.rows[0];

    if (!admin) {
      return null;
    }

    const validPassword = bcrypt.compareSync(password, admin.password);
    if (!validPassword) {
      return null;
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });

    return {
      id: admin.id,
      username: admin.username,
      token
    };
  }

  static async getAdmin(id) {
    const result = await query('SELECT id, username, email, "createdAt" FROM admins WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async getAdminByEmail(email) {
    const result = await query('SELECT * FROM admins WHERE LOWER(email) = $1', [String(email || '').trim().toLowerCase()]);
    return result.rows[0] || null;
  }

  static async createAdmin(username, password, email) {
    const existing = await query('SELECT id FROM admins WHERE username = $1', [username]);

    if (existing.rows.length > 0) {
      throw new Error('Username already exists');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await query(
      'INSERT INTO admins (username, password, email) VALUES ($1, $2, $3) RETURNING id',
      [username, hashedPassword, email || null]
    );

    return { id: result.rows[0].id, username };
  }

  static async setAdminEmail(adminId, email) {
    await query('UPDATE admins SET email = $1 WHERE id = $2', [email, adminId]);
  }

  static async setAdminPassword(adminId, password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    await query('UPDATE admins SET password = $1 WHERE id = $2', [hashedPassword, adminId]);
  }
}

module.exports = AdminService;
