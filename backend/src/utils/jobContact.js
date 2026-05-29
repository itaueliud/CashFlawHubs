const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const normalizeEmail = (value) => String(value || '').trim().replace(/[>),.;]+$/g, '');

const extractEmailFromMailto = (value) => {
  const match = String(value || '').match(/mailto:([^?]+)/i);
  if (!match) return null;
  const email = normalizeEmail(decodeURIComponent(match[1] || ''));
  return EMAIL_PATTERN.test(email) ? email : null;
};

const extractEmailFromText = (value) => {
  const text = String(value || '');
  const match = text.match(EMAIL_PATTERN);
  if (!match || match.length === 0) return null;
  return normalizeEmail(match[0]);
};

const discoverApplicationContact = ({ title = '', company = '', description = '', applicationUrl = '', source = '', extraText = '' } = {}) => {
  const pieces = [applicationUrl, extraText, description, company, title, source].filter(Boolean);

  for (const piece of pieces) {
    const mailtoEmail = extractEmailFromMailto(piece);
    if (mailtoEmail) {
      return { applicationContactEmail: mailtoEmail, applicationContactSource: 'mailto' };
    }
  }

  for (const piece of pieces) {
    const textEmail = extractEmailFromText(piece);
    if (textEmail) {
      return { applicationContactEmail: textEmail, applicationContactSource: 'text' };
    }
  }

  return { applicationContactEmail: null, applicationContactSource: null };
};

module.exports = {
  discoverApplicationContact,
  extractEmailFromMailto,
  extractEmailFromText,
};