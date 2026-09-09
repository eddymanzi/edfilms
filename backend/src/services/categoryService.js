const { query } = require('../config/database');

class CategoryService {
  static async getAll() {
    const result = await query('SELECT * FROM categories ORDER BY name');
    return result.rows;
  }

  static async getBySlug(slug) {
    const result = await query('SELECT * FROM categories WHERE slug = $1', [slug]);
    return result.rows[0] || null;
  }

  static async getById(id) {
    const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async create(name) {
    const slug = await this.generateSlug(name);

    const existing = await query('SELECT id FROM categories WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) throw new Error('Category already exists');

    const result = await query('INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id', [name, slug]);
    return this.getById(result.rows[0].id);
  }

  static async update(id, name) {
    const existing = await query('SELECT * FROM categories WHERE id = $1', [id]);
    if (!existing.rows[0]) return null;

    const slug = await this.generateSlug(name, id);
    await query('UPDATE categories SET name = $1, slug = $2 WHERE id = $3', [name, slug, id]);

    return this.getById(id);
  }

  static async delete(id) {
    const existing = await query('SELECT * FROM categories WHERE id = $1', [id]);
    if (!existing.rows[0]) return false;

    await query('DELETE FROM categories WHERE id = $1', [id]);
    return true;
  }

  static async generateSlug(name, excludeId = null) {
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let originalSlug = slug;
    let counter = 1;

    while (true) {
      const result = await query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [slug, excludeId || 0]);
      if (result.rows.length === 0) return slug;
      slug = `${originalSlug}-${counter}`;
      counter++;
    }
  }
}

module.exports = CategoryService;
