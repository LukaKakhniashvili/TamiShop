/*
 * დინამიკური კონტენტის არასავალდებულო თარგმანები (ადმინი ავსებს ხელით; მანქანური თარგმანი არ ხდება).
 * საბაზისო ველები (name, description...) ქართულია — ის არის fallback. აქ ინახება მხოლოდ სხვა ენები:
 *   { en: { name, description, specifications: [{ key, value }] }, ru: { ... } }
 * ცარიელი ველები/ენები არ ინახება, რომ frontend-მა ქართულზე გადაიაროს.
 */

const TRANSLATION_LANGUAGES = ['en', 'ru'];

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * @param input  მოთხოვნიდან მიღებული translations
 * @param spec   { field: maxLength } ან { specifications: 'specs' } — ინდექსით გასწორებული [{ key, value }]
 * @returns {object|undefined} ნორმალიზებული თარგმანები (ან undefined, თუ ცარიელია)
 */
const normalizeTranslations = (input, spec) => {
  if (!input || typeof input !== 'object') return undefined;
  const out = {};
  for (const lng of TRANSLATION_LANGUAGES) {
    const src = input[lng];
    if (!src || typeof src !== 'object') continue;
    const tr = {};
    for (const [field, max] of Object.entries(spec)) {
      if (max === 'specs') {
        const rows = Array.isArray(src[field])
          ? src[field].slice(0, 100).map((s) => ({ key: str(s?.key, 200), value: str(s?.value, 1000) }))
          : [];
        if (rows.some((r) => r.key || r.value)) tr[field] = rows;
      } else {
        const v = str(src[field], max);
        if (v) tr[field] = v;
      }
    }
    if (Object.keys(tr).length) out[lng] = tr;
  }
  return Object.keys(out).length ? out : undefined;
};

/** მხოლოდ სახელის თარგმანები (შეკვეთის snapshot-ისთვის): { en: { name }, ru: { name } } */
const nameTranslations = (entity) => {
  const out = {};
  for (const lng of TRANSLATION_LANGUAGES) {
    const name = entity?.translations?.[lng]?.name;
    if (name) out[lng] = { name };
  }
  return Object.keys(out).length ? out : undefined;
};

const PRODUCT_TRANSLATION_FIELDS = { name: 200, description: 50000, specifications: 'specs' };
const CATEGORY_TRANSLATION_FIELDS = { name: 100, description: 2000 };
const OPTION_TRANSLATION_FIELDS = { name: 40 };
const VALUE_TRANSLATION_FIELDS = { label: 40 };

module.exports = {
  TRANSLATION_LANGUAGES,
  normalizeTranslations,
  nameTranslations,
  PRODUCT_TRANSLATION_FIELDS,
  CATEGORY_TRANSLATION_FIELDS,
  OPTION_TRANSLATION_FIELDS,
  VALUE_TRANSLATION_FIELDS,
};
