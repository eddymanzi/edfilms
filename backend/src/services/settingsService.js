const { query, getDb } = require('../config/database');

class SettingsService {
  static async get(key) {
    const result = await query('SELECT value FROM settings WHERE key = $1', [key]);
    return result.rows[0] ? result.rows[0].value : null;
  }

  static async getAll() {
    const result = await query('SELECT * FROM settings');
    const settings = {};
    for (const s of result.rows) {
      settings[s.key] = s.value;
    }
    return settings;
  }

  static async set(key, value) {
    await query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
  }

  static async setMultiple(settings) {
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, value]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = SettingsService;