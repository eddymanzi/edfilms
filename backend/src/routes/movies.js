const express = require('express');
const router = express.Router();
const MovieService = require('../services/movieService');
const PaymentService = require('../services/paymentService');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'edfilms_fallback_secret';
const MEDIA_TOKEN_TTL = '10m';
const { MOVIES_DIR } = require('../config/storage');
const { serverErrorMessage } = require('../utils/httpError');

function sendPaymentRequired(res, purpose) {
  const message = purpose === 'download'
    ? 'Payment is required to download this movie.'
    : 'Payment is required to watch this movie.';
  return res.status(402).json({
    success: false,
    error: { code: 'PAYMENT_REQUIRED', message }
  });
}

function signMediaToken(movieId, customerReference, purpose) {
  return jwt.sign({ movieId, ref: customerReference, purpose }, JWT_SECRET, { expiresIn: MEDIA_TOKEN_TTL });
}

function verifyMediaToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function assertMediaAccess(movie, purpose, req) {
  if (purpose === 'watch') {
    if (await PaymentService.canWatch(movie, null)) return { allowed: true };
  } else {
    if (await PaymentService.canDownload(movie, null)) return { allowed: true };
  }

  if (purpose === 'watch' && movie.access_type === 'WATCH_FREE_DOWNLOAD_PAID') {
    return { allowed: true };
  }

  const token = req.query.token;
  if (!token) return { allowed: false };
  const payload = verifyMediaToken(token);
  if (!payload) return { allowed: false };
  if (payload.movieId !== movie.id) return { allowed: false };
  if (payload.purpose !== purpose) return { allowed: false };

  const entitled = await PaymentService.hasEntitlement(movie.id, payload.ref, purpose);
  return { allowed: entitled, customerReference: payload.ref };
}

router.get('/', async (req, res) => {
  try {
    const result = await MovieService.getAll({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search,
      genre: req.query.genre,
      year: req.query.year,
      language: req.query.language,
      category: req.query.category,
      published: 1
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const movies = await MovieService.getFeatured();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const movies = await MovieService.getLatest(limit);
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const movies = await MovieService.getPopular(limit);
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const movie = await MovieService.getById(parseInt(req.params.id));
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json(movie);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const movie = await MovieService.getBySlug(req.params.slug);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json(movie);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.post('/:id/access-token', async (req, res) => {
  try {
    const movie = await MovieService.getById(parseInt(req.params.id, 10));
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    const { customerReference, purpose } = req.body || {};

    if (!['watch', 'download'].includes(purpose)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PURPOSE', message: 'purpose must be watch or download' } });
    }
    if (!customerReference) {
      return res.status(401).json({ success: false, error: { code: 'CUSTOMER_REFERENCE_REQUIRED', message: 'customerReference is required' } });
    }

    if (purpose === 'watch' && await PaymentService.canWatch(movie, null)) {
      return res.json({ success: true, data: { token: signMediaToken(movie.id, customerReference, purpose), purpose, movieId: movie.id } });
    }
    if (purpose === 'download' && await PaymentService.canDownload(movie, null)) {
      return res.json({ success: true, data: { token: signMediaToken(movie.id, customerReference, purpose), purpose, movieId: movie.id } });
    }

    if (purpose === 'watch' && movie.access_type === 'WATCH_FREE_DOWNLOAD_PAID') {
      return res.json({ success: true, data: { token: signMediaToken(movie.id, customerReference, purpose), purpose, movieId: movie.id } });
    }

    if (!await PaymentService.hasEntitlement(movie.id, customerReference, purpose)) {
      return sendPaymentRequired(res, purpose);
    }

    res.json({ success: true, data: { token: signMediaToken(movie.id, customerReference, purpose), purpose, movieId: movie.id } });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/:id/stream', async (req, res) => {
  try {
    const movie = await MovieService.getById(parseInt(req.params.id));
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const access = await assertMediaAccess(movie, 'watch', req);
    if (!access.allowed) {
      return sendPaymentRequired(res, 'watch');
    }

    if (!movie.video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoPath = path.join(MOVIES_DIR, movie.video);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const movie = await MovieService.getById(parseInt(req.params.id));
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    if (!movie.published) return res.status(403).json({ error: 'Movie not published' });

    const access = await assertMediaAccess(movie, 'download', req);
    if (!access.allowed) {
      return sendPaymentRequired(res, 'download');
    }

    if (!movie.video) return res.status(404).json({ error: 'Video file not found' });

    const videoPath = path.join(MOVIES_DIR, movie.video);
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    await MovieService.incrementDownloads(movie.id, req.ip, req.get('User-Agent'));

    const safeTitle = movie.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
    const ext = path.extname(movie.video);
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}${ext}"`);
    res.setHeader('Content-Type', 'video/mp4');

    const stat = fs.statSync(videoPath);
    res.setHeader('Content-Length', stat.size);

    fs.createReadStream(videoPath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.post('/:id/view', async (req, res) => {
  try {
    const movie = await MovieService.getById(parseInt(req.params.id));
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    await MovieService.incrementViews(movie.id, req.ip, req.get('User-Agent'));
    res.json({ message: 'View recorded' });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;