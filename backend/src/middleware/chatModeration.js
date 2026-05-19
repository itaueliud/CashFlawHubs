const blockedPatterns = [
  /\bscam\b/i,
  /\bfraud\b/i,
  /\bfake\s+payment\b/i,
  /\bshare\s+otp\b/i,
  /\bcard\s+pin\b/i,
];

const moderateChatPayload = (req, res, next) => {
  const content = String(req.body?.content || '');
  if (!content.trim()) {
    return res.status(400).json({ success: false, message: 'Message content is required' });
  }
  if (content.length > 3000) {
    return res.status(400).json({ success: false, message: 'Message is too long' });
  }
  if (blockedPatterns.some((pattern) => pattern.test(content))) {
    return res.status(400).json({ success: false, message: 'Message blocked by moderation policy' });
  }
  return next();
};

module.exports = { moderateChatPayload };
