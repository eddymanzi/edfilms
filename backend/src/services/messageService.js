const { query } = require('../config/database');

class MessageService {
  static async create(name, email, message) {
    const result = await query(
      'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3) RETURNING id',
      [name, email, message]
    );
    return { id: result.rows[0].id, name, email, message };
  }

  static async getAll({ page = 1, limit = 20, resolved } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (resolved !== undefined) {
      conditions.push(`resolved = $${paramIndex++}`);
      params.push(resolved);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const totalResult = await query(`SELECT COUNT(*)::int as count FROM contact_messages ${whereClause}`, params);
    const total = totalResult.rows[0].count;

    const messagesResult = await query(
      `SELECT * FROM contact_messages ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      messages: messagesResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  static async getById(id) {
    const result = await query('SELECT * FROM contact_messages WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async markResolved(id) {
    await query('UPDATE contact_messages SET resolved = 1 WHERE id = $1', [id]);
    return this.getById(id);
  }

  static async delete(id) {
    const existing = await query('SELECT id FROM contact_messages WHERE id = $1', [id]);
    if (!existing.rows[0]) return false;
    await query('DELETE FROM contact_messages WHERE id = $1', [id]);
    return true;
  }
}

module.exports = MessageService;
