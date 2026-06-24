require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const CreatorUpload = require('../src/models/CreatorUpload');
const { uploadCreatorVideo } = require('../src/services/r2Storage');

const sanitizeFileName = (value) => String(value || 'video.mp4').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+/, '');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const uploads = await CreatorUpload.find({
    $or: [
      { videoStorageProvider: { $exists: false } },
      { videoStorageProvider: 'local' },
    ],
  }).select('+videoFilePath +videoFileName +videoMimeType +videoStorageProvider +videoStorageKey +videoPublicUrl');

  console.log(`Found ${uploads.length} local creator uploads to evaluate.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const upload of uploads) {
    const localPath = upload.videoFilePath || '';
    if (!localPath || !fs.existsSync(localPath)) {
      skipped += 1;
      console.log(`Skipping ${upload._id}: local file missing.`);
      continue;
    }

    try {
      const storageKey = 'creator-hub/' + upload._id + '/' + sanitizeFileName(upload.videoFileName || path.basename(localPath));

      await uploadCreatorVideo({
        key: storageKey,
        body: fs.createReadStream(localPath),
        contentType: upload.videoMimeType || 'video/mp4',
        contentLength: fs.statSync(localPath).size,
      });

      upload.videoStorageProvider = 'r2';
      upload.videoStorageKey = storageKey;
      upload.videoPublicUrl = process.env.R2_PUBLIC_URL ? `${String(process.env.R2_PUBLIC_URL).replace(/\/+$/, '')}/${storageKey}` : '';
      upload.videoFilePath = `r2://${process.env.R2_BUCKET_NAME || 'creator-hub'}/${storageKey}`;
      await upload.save();

      migrated += 1;
      console.log(`Migrated ${upload._id} -> ${storageKey}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed to migrate ${upload._id}: ${error.message}`);
    }
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} failed=${failed}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});


