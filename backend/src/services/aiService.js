const axios = require('axios');

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const isConfigured = () => Boolean(process.env.OPENAI_API_KEY);

const buildSystemPrompt = (context = {}) => {
  const pieces = [
    'You are a helpful chat assistant for CashFlawHubS job conversations.',
    'Keep responses concise, professional, and safe.',
    'Do not claim actions were done unless explicitly asked to draft a message.',
  ];

  if (context.jobTitle) pieces.push(`Job title: ${context.jobTitle}`);
  if (context.company) pieces.push(`Company: ${context.company}`);
  if (Array.isArray(context.ragSnippets) && context.ragSnippets.length) {
    const snippets = context.ragSnippets
      .map((s, i) => `Snippet ${i + 1} (${s.role}): ${s.content}`)
      .join(' ');
    pieces.push(`Relevant prior context: ${snippets}`);
  }

  return pieces.join(' ');
};

const fallbackReply = (message = '', role = 'applicant') => {
  if (role === 'applicant') {
    return `Thanks for your message. Here's a polished version you can send: "${message}". You can also add 1-2 measurable achievements and availability.`;
  }
  return 'Thanks for the update. I can help you draft a clearer response or summarize candidate fit if you share what matters most for this role.';
};

const generateReply = async ({ history = [], context = {}, senderRole = 'applicant' }) => {
  const latest = history[history.length - 1]?.content || '';
  if (!isConfigured()) {
    return fallbackReply(latest, senderRole);
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...history.slice(-12).map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];

  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      model: OPENAI_MODEL,
      temperature: 0.3,
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );

  return response?.data?.choices?.[0]?.message?.content?.trim() || fallbackReply(latest, senderRole);
};

module.exports = {
  generateReply,
};
