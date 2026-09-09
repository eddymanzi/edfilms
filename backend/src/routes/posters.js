const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { POSTERS_DIR } = require('../config/storage');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);

    if (filename !== req.params.filename || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const filePath = path.join(POSTERS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Poster not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;