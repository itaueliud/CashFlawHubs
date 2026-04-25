const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'registrations');

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '').toLowerCase()}`;
    cb(null, safeName);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);

  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, WEBP, or PDF files are allowed'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;