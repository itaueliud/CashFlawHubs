const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.resolve(process.env.CREATOR_HUB_UPLOAD_ROOT || path.join(__dirname, '..', '..', 'uploads-private', 'creator-hub'));
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error('Only MP4, MOV, WEBM, or MKV video files are allowed'));
  }
  return cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

