const ChatMessage = require('../models/ChatMessage');

const normalize = (text = '') => String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

const toVector = (text = '') => {
  const map = {};
  const words = normalize(text).split(/\s+/).filter(Boolean);
  for (const word of words) map[word] = (map[word] || 0) + 1;
  return map;
};

const similarity = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of keys) {
    const av = a[key] || 0;
    const bv = b[key] || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const retrieveRelevantContext = async ({ sessionId, prompt, limit = 4 }) => {
  const queryVector = toVector(prompt);
  const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: -1 }).limit(80).lean();
  const ranked = messages
    .map((msg) => ({ msg, score: similarity(queryVector, toVector(msg.content || '')) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({ role: entry.msg.role, content: entry.msg.content, score: Number(entry.score.toFixed(4)) }));

  return ranked;
};

module.exports = { retrieveRelevantContext };
