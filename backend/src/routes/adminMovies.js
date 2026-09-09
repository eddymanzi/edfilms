const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const MovieService = require('../services/movieService');
const { authenticateAdmin } = require('../middleware/auth');
const { MOVIES_DIR, POSTERS_DIR } = require('../config/storage');
const { serverErrorMessage } = require('../utils/httpError');

const MB = 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = (parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 4096) * MB;
const MAX_POSTER_SIZE_BYTES = (parseInt(process.env.MAX_POSTER_SIZE_MB, 10) || 10) * MB;
const MAX_VIDEO_SIZE_MB = MAX_VIDEO_SIZE_BYTES / MB;
const MAX_POSTER_SIZE_MB = MAX_POSTER_SIZE_BYTES / MB;

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.mov'];
const POSTER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const dirsExist = {};
function ensureDir(dir) {
  if (!dirsExist[dir]) {
    fs.mkdirSync(dir, { recursive: true });
    dirsExist[dir] = true;
  }
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(MOVIES_DIR);
    cb(null, MOVIES_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = VIDEO_EXTENSIONS.includes(ext) ? ext : '';
    cb(null, `${crypto.randomBytes(16).toString('hex')}${safeExt}`);
  }
});

const posterStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(POSTERS_DIR);
    cb(null, POSTERS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = POSTER_EXTENSIONS.includes(ext) ? ext : '';
    cb(null, `${crypto.randomBytes(16).toString('hex')}${safeExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'video') {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(ext)) {
      return cb(new Error('Only .mp4, .webm, .mkv, and .mov video files are allowed'), false);
    }
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'), false);
    }
    cb(null, true);
  } else if (file.fieldname === 'poster') {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!POSTER_EXTENSIONS.includes(ext)) {
      return cb(new Error('Only .jpg, .jpeg, .png, and .webp image files are allowed'), false);
    }
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  } else {
    cb(new Error('Unexpected field'), false);
  }
};

const upload = multer({
  storage: {
    _handleFile: (req, file, cb) => {
      const storageFor = file.fieldname === 'video' ? videoStorage : posterStorage;
      storageFor._handleFile(req, file, cb);
    },
    _removeFile: (req, file, cb) => {
      const storageFor = file.fieldname === 'video' ? videoStorage : posterStorage;
      storageFor._removeFile(req, file, cb);
    }
  },
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES
  }
});

const uploadFields = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'poster', maxCount: 1 }
]);

function rejectPosterTooLarge(res) {
  const message = `Poster file is too large. Maximum allowed size is ${MAX_POSTER_SIZE_MB} MB.`;
  return res.status(413).json({
    success: false,
    message,
    error: message,
    field: 'poster',
    maxSizeMB: MAX_POSTER_SIZE_MB
  });
}

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await MovieService.getAll({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search,
      published: req.query.published !== undefined ? parseInt(req.query.published) : undefined
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.post('/', authenticateAdmin, uploadFields, async (req, res) => {
  try {
    if (req.files?.poster?.[0] && req.files.poster[0].size > MAX_POSTER_SIZE_BYTES) {
      fs.unlink(req.files.poster[0].path, () => {});
      return rejectPosterTooLarge(res);
    }

    const data = {
      title: req.body.title,
      description: req.body.description,
      year: parseInt(req.body.year) || null,
      language: req.body.language,
      duration: parseInt(req.body.duration) || 0,
      rating: parseFloat(req.body.rating) || 0,
      genre: req.body.genre,
      featured: req.body.featured === 'true' || req.body.featured === '1',
      published: req.body.published === 'true' || req.body.published === '1',
      allowDownload: req.body.allowDownload !== 'false' && req.body.allowDownload !== '0',
      accessType: req.body.accessType || 'FREE',
      downloadAccess: req.body.downloadAccess,
      priceRwf: parseInt(req.body.priceRwf, 10) || 0,
      categories: req.body.categories ? JSON.parse(req.body.categories) : []
    };

    if (req.files?.video?.[0]) {
      data.video = req.files.video[0].filename;
    }
    if (req.files?.poster?.[0]) {
      data.poster = req.files.poster[0].filename;
    }

    const movie = await MovieService.create(data);
    res.status(201).json(movie);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', authenticateAdmin, uploadFields, async (req, res) => {
  try {
    if (req.files?.poster?.[0] && req.files.poster[0].size > MAX_POSTER_SIZE_BYTES) {
      fs.unlink(req.files.poster[0].path, () => {});
      return rejectPosterTooLarge(res);
    }

    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.year !== undefined) data.year = parseInt(req.body.year) || null;
    if (req.body.language !== undefined) data.language = req.body.language;
    if (req.body.duration !== undefined) data.duration = parseInt(req.body.duration) || 0;
    if (req.body.rating !== undefined) data.rating = parseFloat(req.body.rating) || 0;
    if (req.body.genre !== undefined) data.genre = req.body.genre;
    if (req.body.featured !== undefined) data.featured = req.body.featured === 'true' || req.body.featured === '1';
    if (req.body.published !== undefined) data.published = req.body.published === 'true' || req.body.published === '1';
    if (req.body.allowDownload !== undefined) data.allowDownload = req.body.allowDownload !== 'false' && req.body.allowDownload !== '0';
    if (req.body.accessType !== undefined) data.accessType = req.body.accessType;
    if (req.body.downloadAccess !== undefined) data.downloadAccess = req.body.downloadAccess;
    if (req.body.priceRwf !== undefined) data.priceRwf = parseInt(req.body.priceRwf, 10) || 0;
    if (req.body.categories !== undefined) data.categories = JSON.parse(req.body.categories);

    if (req.files?.video?.[0]) data.video = req.files.video[0].filename;
    if (req.files?.poster?.[0]) data.poster = req.files.poster[0].filename;

    const movie = await MovieService.update(parseInt(req.params.id), data);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    res.json(movie);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await MovieService.delete(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Movie not found' });
    res.json({ message: 'Movie deleted' });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;