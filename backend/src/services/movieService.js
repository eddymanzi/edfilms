const { query } = require('../config/database');
const { MOVIES_DIR, POSTERS_DIR } = require('../config/storage');
const path = require('path');
const fs = require('fs');

class MovieService {
  static async getAll({ page = 1, limit = 20, search, genre, year, language, category, published } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (published !== undefined) {
      conditions.push(`m.published = $${paramIndex++}`);
      params.push(published);
    }

    if (search) {
      conditions.push(`(m.title ILIKE $${paramIndex} OR m.genre ILIKE $${paramIndex + 1} OR m.description ILIKE $${paramIndex + 2})`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramIndex += 3;
    }

    if (genre) {
      conditions.push(`m.genre ILIKE $${paramIndex++}`);
      params.push(`%${genre}%`);
    }

    if (year) {
      conditions.push(`m.year = $${paramIndex++}`);
      params.push(year);
    }

    if (language) {
      conditions.push(`m.language ILIKE $${paramIndex++}`);
      params.push(`%${language}%`);
    }

    let joinClause = '';
    let whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    if (category) {
      joinClause = 'JOIN movie_categories mc ON m.id = mc."movieId" JOIN categories c ON mc."categoryId" = c.id';
      conditions.push(`c.slug = $${paramIndex++}`);
      params.push(category);
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const countResult = await query(`SELECT COUNT(DISTINCT m.id)::int as total FROM movies m ${joinClause} ${whereClause}`, params);
    const total = countResult.rows[0] ? countResult.rows[0].total : 0;

    const moviesResult = await query(`
      SELECT DISTINCT m.*
      FROM movies m ${joinClause} ${whereClause}
      ORDER BY m."createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);

    return {
      movies: moviesResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async getById(id) {
    const result = await query('SELECT * FROM movies WHERE id = $1', [id]);
    const movie = result.rows[0];
    if (!movie) return null;

    const categoriesResult = await query(`
      SELECT c.* FROM categories c
      JOIN movie_categories mc ON c.id = mc."categoryId"
      WHERE mc."movieId" = $1
    `, [id]);

    return { ...movie, categories: categoriesResult.rows };
  }

  static async getBySlug(slug) {
    const result = await query('SELECT * FROM movies WHERE slug = $1', [slug]);
    const movie = result.rows[0];
    if (!movie) return null;

    const categoriesResult = await query(`
      SELECT c.* FROM categories c
      JOIN movie_categories mc ON c.id = mc."categoryId"
      WHERE mc."movieId" = $1
    `, [movie.id]);

    return { ...movie, categories: categoriesResult.rows };
  }

  static async getFeatured() {
    const result = await query('SELECT * FROM movies WHERE featured = 1 AND published = 1 ORDER BY "createdAt" DESC LIMIT 5');
    return result.rows;
  }

  static async getLatest(limit = 10) {
    const result = await query('SELECT * FROM movies WHERE published = 1 ORDER BY "createdAt" DESC LIMIT $1', [limit]);
    return result.rows;
  }

  static async getPopular(limit = 10) {
    const result = await query('SELECT * FROM movies WHERE published = 1 ORDER BY views DESC LIMIT $1', [limit]);
    return result.rows;
  }

  static sanitizeMonetization(data) {
    const accessType = (data.accessType || data.access_type || 'FREE').toUpperCase();
    const downloadAccess = (data.downloadAccess || data.download_access || 'FREE').toUpperCase();
    const priceRwf = Math.max(0, parseInt(data.priceRwf !== undefined ? data.priceRwf : (data.price_rwf !== undefined ? data.price_rwf : 0), 10) || 0);

    let resolvedAccessType = 'FREE';
    if (accessType === 'PREMIUM') {
      resolvedAccessType = 'PREMIUM';
    } else if (accessType === 'WATCH_FREE_DOWNLOAD_PAID') {
      resolvedAccessType = 'WATCH_FREE_DOWNLOAD_PAID';
    }

    let resolvedDownloadAccess = 'FREE';
    if (resolvedAccessType === 'PREMIUM') {
      resolvedDownloadAccess = 'PAID';
    } else if (resolvedAccessType === 'WATCH_FREE_DOWNLOAD_PAID') {
      resolvedDownloadAccess = 'PAID';
    } else {
      resolvedDownloadAccess = downloadAccess === 'PAID' ? 'PAID' : 'FREE';
    }

    let resolvedPrice = priceRwf;
    if (resolvedAccessType === 'FREE' && resolvedDownloadAccess === 'FREE') {
      resolvedPrice = 0;
    } else if (resolvedPrice <= 0) {
      resolvedPrice = 0;
    }

    return { accessType: resolvedAccessType, downloadAccess: resolvedDownloadAccess, priceRwf: resolvedPrice };
  }

  static async create(data) {
    const slug = await this.generateSlug(data.title);
    const monetization = this.sanitizeMonetization(data);

    const result = await query(`
      INSERT INTO movies (title, slug, description, poster, video, year, language, duration, rating, genre, featured, published, "allowDownload", access_type, download_access, price_rwf)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
      data.title,
      slug,
      data.description || '',
      data.poster || '',
      data.video || '',
      data.year || null,
      data.language || 'English',
      data.duration || 0,
      data.rating || 0,
      data.genre || '',
      data.featured ? 1 : 0,
      data.published ? 1 : 0,
      data.allowDownload !== false ? 1 : 0,
      monetization.accessType,
      monetization.downloadAccess,
      monetization.priceRwf
    ]);

    const newId = result.rows[0].id;

    if (data.categories && data.categories.length > 0) {
      for (const categoryId of data.categories) {
        await query(
          'INSERT INTO movie_categories ("movieId", "categoryId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newId, categoryId]
        );
      }
    }

    return this.getById(newId);
  }

  static async update(id, data) {
    const existingResult = await query('SELECT * FROM movies WHERE id = $1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) return null;

    let slug = existing.slug;
    if (data.title && data.title !== existing.title) {
      slug = await this.generateSlug(data.title, id);
    }

    const hasMonetization = data.accessType !== undefined || data.access_type !== undefined ||
      data.downloadAccess !== undefined || data.download_access !== undefined ||
      data.priceRwf !== undefined || data.price_rwf !== undefined;

    let monetization = null;
    if (hasMonetization) {
      monetization = this.sanitizeMonetization({
        accessType: data.accessType !== undefined ? data.accessType : existing.access_type,
        downloadAccess: data.downloadAccess !== undefined ? data.downloadAccess : existing.download_access,
        priceRwf: data.priceRwf !== undefined ? data.priceRwf : data.price_rwf !== undefined ? data.price_rwf : existing.price_rwf,
        ...(data.access_type !== undefined ? { accessType: data.access_type } : {}),
        ...(data.download_access !== undefined ? { downloadAccess: data.download_access } : {})
      });
    }

    await query(`
      UPDATE movies SET
        title = $1, slug = $2, description = $3, poster = $4, video = $5,
        year = $6, language = $7, duration = $8, rating = $9, genre = $10,
        featured = $11, published = $12, "allowDownload" = $13,
        access_type = $14, download_access = $15, price_rwf = $16,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $17
    `, [
      data.title || existing.title,
      slug,
      data.description !== undefined ? data.description : existing.description,
      data.poster !== undefined ? data.poster : existing.poster,
      data.video !== undefined ? data.video : existing.video,
      data.year !== undefined ? data.year : existing.year,
      data.language !== undefined ? data.language : existing.language,
      data.duration !== undefined ? data.duration : existing.duration,
      data.rating !== undefined ? data.rating : existing.rating,
      data.genre !== undefined ? data.genre : existing.genre,
      data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured,
      data.published !== undefined ? (data.published ? 1 : 0) : existing.published,
      data.allowDownload !== undefined ? (data.allowDownload ? 1 : 0) : existing.allowDownload,
      monetization ? monetization.accessType : existing.access_type,
      monetization ? monetization.downloadAccess : existing.download_access,
      monetization ? monetization.priceRwf : existing.price_rwf,
      id
    ]);

    if (data.categories !== undefined) {
      await query('DELETE FROM movie_categories WHERE "movieId" = $1', [id]);
      if (data.categories.length > 0) {
        for (const categoryId of data.categories) {
          await query(
            'INSERT INTO movie_categories ("movieId", "categoryId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, categoryId]
          );
        }
      }
    }

    return this.getById(id);
  }

  static async delete(id) {
    const result = await query('SELECT * FROM movies WHERE id = $1', [id]);
    const movie = result.rows[0];
    if (!movie) return false;

    if (movie.poster) {
      const posterPath = path.join(POSTERS_DIR, movie.poster);
      if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
    }
    if (movie.video) {
      const videoPath = path.join(MOVIES_DIR, movie.video);
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    }

    await query('DELETE FROM movies WHERE id = $1', [id]);
    return true;
  }

  static async incrementViews(id, ip, userAgent) {
    await query('UPDATE movies SET views = views + 1 WHERE id = $1', [id]);
    await query('INSERT INTO views ("movieId", "ipAddress", "userAgent") VALUES ($1, $2, $3)', [id, ip, userAgent]);
  }

  static async incrementDownloads(id, ip, userAgent) {
    await query('UPDATE movies SET downloads = downloads + 1 WHERE id = $1', [id]);
    await query('INSERT INTO downloads ("movieId", "ipAddress", "userAgent") VALUES ($1, $2, $3)', [id, ip, userAgent]);
  }

  static async generateSlug(title, excludeId = null) {
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let originalSlug = slug;
    let counter = 1;

    while (true) {
      const result = await query('SELECT id FROM movies WHERE slug = $1 AND id != $2', [slug, excludeId || 0]);
      if (result.rows.length === 0) return slug;
      slug = `${originalSlug}-${counter}`;
      counter++;
    }
  }

  static async getStats() {
    const totalMovies = (await query('SELECT COUNT(*)::int as count FROM movies')).rows[0].count;
    const publishedMovies = (await query('SELECT COUNT(*)::int as count FROM movies WHERE published = 1')).rows[0].count;
    const unpublishedMovies = totalMovies - publishedMovies;
    const totalViews = (await query('SELECT COALESCE(SUM(views), 0)::int as count FROM movies')).rows[0].count;
    const totalDownloads = (await query('SELECT COALESCE(SUM(downloads), 0)::int as count FROM movies')).rows[0].count;
    const totalMessages = (await query('SELECT COUNT(*)::int as count FROM contact_messages')).rows[0].count;
    const freeMovies = (await query("SELECT COUNT(*)::int as count FROM movies WHERE access_type = 'FREE'")).rows[0].count;
    const paidMovies = (await query("SELECT COUNT(*)::int as count FROM movies WHERE access_type IN ('WATCH_FREE_DOWNLOAD_PAID', 'PREMIUM')")).rows[0].count;
    const freeDownloads = (await query("SELECT COUNT(*)::int as count FROM movies WHERE download_access = 'FREE'")).rows[0].count;
    const paidDownloads = (await query("SELECT COUNT(*)::int as count FROM movies WHERE download_access = 'PAID'")).rows[0].count;
    const recentMovies = (await query('SELECT * FROM movies ORDER BY "createdAt" DESC LIMIT 5')).rows;

    let paymentStats = {};
    try {
      const PaymentService = require('./paymentService');
      paymentStats = await PaymentService.getStats();
    } catch {
      paymentStats = {};
    }

    return {
      totalMovies,
      publishedMovies,
      unpublishedMovies,
      totalViews,
      totalDownloads,
      totalMessages,
      freeMovies,
      paidMovies,
      freeDownloads,
      paidDownloads,
      recentMovies,
      payments: paymentStats
    };
  }
}

module.exports = MovieService;
