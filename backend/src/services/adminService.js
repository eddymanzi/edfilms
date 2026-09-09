const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'edfilms_fallback_secret';

class AdminService {
  static async login(username, password) {
    const result = await query('SELECT * FROM admins WHERE username = $1', [username]);
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
    const result = await query('SELECT id, username, "createdAt" FROM admins WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async createAdmin(username, password) {
    const existing = await query('SELECT id FROM admins WHERE username = $1', [username]);

    if (existing.rows.length > 0) {
      throw new Error('Username already exists');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await query('INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING id', [username, hashedPassword]);

    return { id: result.rows[0].id, username };
  }
}

module.exports = AdminService;
