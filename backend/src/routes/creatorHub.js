const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const creatorHubUpload = require('../middleware/creatorHubUpload');
const {
  getMeta,
  listUploads,
  getUploadById,
  myUploads,
  listSavedUploads,
  saveUpload,
  unsaveUpload,
  createUpload,
  unlockUploadWithWallet,
  streamUpload,
  deleteUpload,
} = require('../controllers/creatorHubController');

const streamAuthFromQuery = (req, _res, next) => {
  if (!req.headers.authorization && req.query?.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

router.get('/meta', protect, getMeta);
router.get('/uploads', protect, listUploads);
router.get('/saved', protect, listSavedUploads);
router.get('/uploads/mine', protect, myUploads);
router.get('/uploads/:id', protect, getUploadById);
router.get('/uploads/:id/stream', streamAuthFromQuery, protect, streamUpload);
router.post('/uploads', protect, creatorHubUpload.single('file'), createUpload);
router.post('/uploads/:id/save', protect, saveUpload);
router.delete('/uploads/:id/save', protect, unsaveUpload);
router.post('/uploads/:id/unlock', protect, unlockUploadWithWallet);
router.delete('/uploads/:id', protect, deleteUpload);

module.exports = router;
