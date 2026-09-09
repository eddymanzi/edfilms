const path = require('path');
const fs = require('fs');

const DEFAULT_STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');

const STORAGE_DIR = (process.env.STORAGE_DIR || DEFAULT_STORAGE_DIR).replace(/[\/\\]+$/, '');
const MOVIES_DIR = path.join(STORAGE_DIR, 'movies');
const POSTERS_DIR = path.join(STORAGE_DIR, 'posters');

function ensureStorageDirs() {
  for (const dir of [STORAGE_DIR, MOVIES_DIR, POSTERS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { STORAGE_DIR, MOVIES_DIR, POSTERS_DIR, ensureStorageDirs, DEFAULT_STORAGE_DIR };