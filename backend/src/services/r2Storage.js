const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const bucket = String(process.env.R2_BUCKET_NAME || '').trim();
const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
const endpointUrl = String(process.env.R2_S3_API_URL || '').trim();
const publicBaseUrl = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');

const isConfigured = Boolean(bucket && accessKeyId && secretAccessKey && endpointUrl);

const getEndpoint = () => {
  if (!endpointUrl) return '';
  try {
    const parsed = new URL(endpointUrl);
    return parsed.origin;
  } catch {
    return endpointUrl.replace(/\/+$/, '');
  }
};

const client = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: getEndpoint(),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    })
  : null;

const sanitizeFileName = (value) => String(value || 'video.mp4').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+/, '');

const buildCreatorHubKey = ({ uploadId, fileName }) => {
  const safeName = sanitizeFileName(fileName || 'video.mp4');
  return `creator-hub/${uploadId}/${Date.now()}-${safeName}`;
};

const uploadCreatorVideo = async ({ key, body, contentType, contentLength }) => {
  if (!client || !bucket) {
    throw new Error('R2 is not configured');
  }

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'video/mp4',
    ContentLength: contentLength,
  }));

  return {
    key,
    publicUrl: publicBaseUrl ? `${publicBaseUrl}/${key}` : '',
  };
};

const deleteCreatorVideo = async (key) => {
  if (!client || !bucket || !key) return;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (_) {
    // noop
  }
};

const getCreatorVideoObject = async ({ key, range } = {}) => {
  if (!client || !bucket || !key) {
    throw new Error('R2 is not configured');
  }

  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: range,
  }));

  return response;
};

module.exports = {
  isConfigured,
  buildCreatorHubKey,
  uploadCreatorVideo,
  deleteCreatorVideo,
  getCreatorVideoObject,
};
