const moderateChatPayload = (req, res, next) => {
  const content = String(req.body?.content || '');
  if (!content.trim()) {
    return res.status(400).json({ success: false, message: 'Message content is required' });
  }
  if (content.length > 3000) {
    return res.status(400).json({ success: false, message: 'Message is too long' });
  }
  return next();
};

module.exports = { moderateChatPayload };
