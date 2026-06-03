const fs = require('fs');
const path = require('path');

const SUPPORTED = ['sw', 'fr'];
const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/;

const root = path.join(process.cwd(), 'src', 'i18n');
const enPath = path.join(root, 'locales', 'en', 'translation.json');

const flatten = (obj, prefix = '', out = {}) => {
  Object.entries(obj).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, nextKey, out);
      return;
    }
    out[nextKey] = String(value);
  });
  return out;
};

const unflatten = (flat) => {
  const out = {};
  Object.entries(flat).forEach(([key, value]) => {
    key.split('.').reduce((acc, part, index, parts) => {
      if (index === parts.length - 1) {
        acc[part] = value;
        return acc[part];
      }
      acc[part] = acc[part] || {};
      return acc[part];
    }, out);
  });
  return out;
};

const translate = async (text, target) => {
  if (!text || PLACEHOLDER_PATTERN.test(text)) return text;
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `en|${target}`);
  const res = await fetch(url.toString());
  if (!res.ok) return text;
  const payload = await res.json();
  return payload?.responseData?.translatedText || text;
};

async function main() {
  const english = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const flatEnglish = flatten(english);

  for (const lang of SUPPORTED) {
    const translated = {};
    for (const [key, value] of Object.entries(flatEnglish)) {
      translated[key] = await translate(value, lang);
    }
    const nested = unflatten(translated);
    const outPath = path.join(root, 'locales', lang, 'translation.json');
    fs.writeFileSync(outPath, `${JSON.stringify(nested, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
