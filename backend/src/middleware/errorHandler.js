const multer = require('multer');

const MAX_VIDEO_SIZE_MB = (parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 4096);
const MAX_POSTER_SIZE_MB = (parseInt(process.env.MAX_POSTER_SIZE_MB, 10) || 10);

function errorHandler(err, req, res, next) {
  console.error('Error:', err.message, err.stack);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'File too large' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    const field = (err.field && err.field.startsWith('video')) ? 'video' : 'poster';
    const maxMB = field === 'video' ? MAX_VIDEO_SIZE_MB : MAX_POSTER_SIZE_MB;
    const label = field === 'video' ? 'Video' : 'Poster';
    const maxText = field === 'video'
      ? `${MAX_VIDEO_SIZE_MB / 1024} GB`
      : `${MAX_POSTER_SIZE_MB} MB`;
    const message = `${label} file is too large. Maximum allowed size is ${maxText}.`;
    return res.status(413).json({
      success: false,
      message,
      error: message,
      field,
      maxSizeMB: maxMB
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected file field' });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }

  const status = err.status || 500;
  if (status >= 500 && process.env.NODE_ENV === 'production') {
    return res.status(status).json({ error: 'Internal server error' });
  }

  res.status(status).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = { errorHandler };