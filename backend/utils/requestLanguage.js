/*
 * მოთხოვნის ენა: ?lang= → Accept-Language (frontend-ი ყოველთვის აგზავნის არჩეულ ენას) → ka.
 * გამოიყენება სახელით სორტირებისთვის და ელ. წერილების ენისთვის.
 */
const SUPPORTED_LANGUAGES = ['ka', 'en', 'ru'];
const DEFAULT_LANGUAGE = 'ka';

const normalizeLanguage = (value) => {
  const code = String(value || '').trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(code) ? code : null;
};

const requestLanguage = (req) => {
  const fromQuery = normalizeLanguage(req.query?.lang);
  if (fromQuery) return fromQuery;
  const header = String(req.headers?.['accept-language'] || '');
  for (const part of header.split(',')) {
    const lng = normalizeLanguage(part.split(';')[0]);
    if (lng) return lng;
  }
  return DEFAULT_LANGUAGE;
};

module.exports = { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage, requestLanguage };
