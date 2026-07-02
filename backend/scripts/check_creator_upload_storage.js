require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
require('../src/models/User');
const CreatorUpload = require('../src/models/CreatorUpload');

const uploadId = process.argv[2];

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  if (!uploadId) {
    throw new Error('Usage: node scripts/check_creator_upload_storage.js <creatorUploadId>');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const upload = await CreatorUpload.findById(uploadId)
    .select('+videoFilePath +videoFileName +videoMimeType +videoStorageProvider +videoStorageKey +videoPublicUrl +videoSizeBytes +status +title +creatorId')
    .populate('creatorId', 'name email country');

  if (!upload) {
    console.log(JSON.stringify({ found: false, uploadId }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const localFileExists = upload.videoFilePath ? fs.existsSync(upload.videoFilePath) : false;

  const report = {
    found: true,
    uploadId: upload._id.toString(),
    title: upload.title,
    status: upload.status,
    creator: upload.creatorId ? {
      id: upload.creatorId._id?.toString?.() || String(upload.creatorId._id || ''),
      name: upload.creatorId.name || '',
      email: upload.creatorId.email || '',
      country: upload.creatorId.country || '',
    } : null,
    videoStorageProvider: upload.videoStorageProvider || 'local',
    videoStorageKey: upload.videoStorageKey || '',
    videoPublicUrl: upload.videoPublicUrl || '',
    videoFilePath: upload.videoFilePath || '',
    videoFileName: upload.videoFileName || '',
    videoMimeType: upload.videoMimeType || '',
    videoSizeBytes: upload.videoSizeBytes || 0,
    localFileExists,
    streamRoute: `/api/creator-hub/uploads/${upload._id}/stream`,
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

