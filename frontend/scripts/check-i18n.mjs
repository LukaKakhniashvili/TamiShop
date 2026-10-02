/*
 * თარგმანების შემოწმება: npm run i18n:check
 *   1. კოდში გამოყენებული ყველა t('…') / i18nKey="…" გასაღები არსებობს ka/en/ru-ში (plural-ებიც)
 *   2. დინამიკური გასაღებების (t(`orderStatus.${…}`)) ცნობილი მნიშვნელობები არსებობს
 *   3. სამივე ფაილს ერთნაირი სტრუქტურა აქვს (plural ფორმების გარდა) და ცარიელი ტექსტი არ არის
 *   4. {{ცვლადები}} ერთნაირია ყველა ენაზე
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const LANGS = ['ka', 'en', 'ru'];
const locales = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, 'locales', `${l}.json`), 'utf8'))]));

// ცნობილი დინამიკური სიმრავლეები (ენუმები/id-ები)
const DYNAMIC = {
  'profile.tracking.*': ['pending', 'processing', 'shipped', 'completed', 'cancelled'],
  'notifications.types.*': ['order', 'marketing', 'promotion', 'system'],
  'notifications.templates.order_status.*': ['processing', 'shipped', 'completed', 'cancelled'],
  'reviews.*': ['newest', 'highest', 'lowest'],
  'reviews.ratingWords.*': ['1', '2', '3', '4', '5'],
  'orderStatus.*': ['pending', 'processing', 'shipped', 'completed', 'cancelled'],
  'paymentStatus.*': ['pending', 'paid', 'pay_on_delivery', 'failed', 'cancelled', 'refunded'],
  'paymentMethodShort.*': ['card', 'cod'],
  'checkout.paymentMethods.*.label': ['card', 'cod'],
  'checkout.paymentMethods.*.description': ['card', 'cod'],
  'checkout.banks.*': ['BOG', 'TBC'],
  'checkout.deliveryMethods.*': ['standard'],
  'checkout.errors.*': ['firstName', 'lastName', 'phone', 'city', 'street', 'paymentMethod', 'bank', 'items', 'deliveryMethod'],
  'hub.quick.*': ['discounted', 'deals', 'new', 'cheap'],
  'catalog.sort.*': ['newest', 'name_asc', 'name_desc', 'price_asc', 'price_desc', 'discount_desc'],
  'hero.slides.*.eyebrow': ['sale', 'delivery', 'cashback'],
  'hero.slides.*.title': ['sale', 'delivery', 'cashback'],
  'hero.slides.*.titleAccent': ['sale', 'delivery', 'cashback'],
  'hero.slides.*.subtitle': ['sale', 'delivery', 'cashback'],
  'home.perks.*.title': ['freeDelivery', 'deliveryTime', 'payOnDelivery'],
  'home.perks.*.text': ['freeDelivery', 'deliveryTime', 'payOnDelivery'],
  'recovery.steps.*': ['email', 'code', 'password'],
  'recovery.subtitle.*': ['email', 'code', 'password', 'done'],
  'password.rules.*': ['length', 'upper', 'lower', 'digit', 'special'],
  'errors.codes.*': [
    'RATE_LIMITED', 'RESEND_COOLDOWN', 'EMAIL_FAILED', 'CODE_NOT_FOUND', 'CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'CODE_INVALID',
    'CODE_INVALID_LAST', 'VERIFICATION_REQUIRED', 'WEAK_PASSWORD', 'NO_PASSWORD', 'CURRENT_PASSWORD_REQUIRED',
    'CURRENT_PASSWORD_INCORRECT', 'PASSWORD_MISMATCH', 'SAME_PASSWORD', 'INVALID_EMAIL', 'EMAIL_NOT_FOUND', 'EMAIL_EXISTS',
    'ACCOUNT_DISABLED', 'ACCOUNT_UNAVAILABLE', 'RESET_TOKEN_INVALID', 'GOOGLE_FAILED', 'REQUIRED_FIELDS', 'INVALID_CREDENTIALS',
    'UNAUTHORIZED', 'PRODUCT_UNAVAILABLE', 'VARIANT_REQUIRED', 'VARIANT_NOT_FOUND', 'VARIANT_INACTIVE', 'OUT_OF_STOCK',
    'ORDER_NOT_FOUND', 'NOT_CANCELLABLE', 'WISHLIST_FULL', 'INVALID_PRODUCT', 'INVALID_RATING', 'COMMENT_TOO_SHORT',
    'COMMENT_TOO_LONG', 'NOT_PURCHASED', 'ALREADY_REVIEWED', 'REVIEW_NOT_FOUND',
  ],
};

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sources = walk(root).filter((f) => /\.(jsx?|tsx?)$/.test(f));

const used = new Map(); // key -> file
const dynamicUsed = new Map(); // pattern -> file
for (const file of sources) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  for (const m of src.matchAll(/\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) used.set(m[1], rel);
  for (const m of src.matchAll(/i18nKey="([A-Za-z0-9_.]+)"/g)) used.set(m[1], rel);
  // გასაღები, რომელიც მოგვიანებით გადაეცემა t()-ს (მაგ. ვალიდაციის შეცდომები)
  for (const m of src.matchAll(/'((?:checkout|errors|otp|password|auth|common|reviews)\.[A-Za-z0-9_.]+)'/g)) used.set(m[1], rel);
  for (const m of src.matchAll(/\bt\(\s*`([^`]+)`/g)) dynamicUsed.set(m[1].replace(/\$\{[^}]+\}/g, '*'), rel);
}

const get = (obj, key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
const pluralForms = { ka: ['one', 'other'], en: ['one', 'other'], ru: ['one', 'few', 'many', 'other'] };
const errors = [];

const checkKey = (key, where) => {
  for (const lng of LANGS) {
    const v = get(locales[lng], key);
    if (typeof v === 'string') {
      if (!v.trim()) errors.push(`${lng}: empty "${key}" (${where})`);
      continue;
    }
    // plural
    const forms = pluralForms[lng].map((f) => get(locales[lng], `${key}_${f}`));
    if (forms.some((f) => typeof f === 'string')) {
      pluralForms[lng].forEach((f, i) => typeof forms[i] !== 'string' && errors.push(`${lng}: missing plural "${key}_${f}" (${where})`));
    } else errors.push(`${lng}: missing "${key}" (${where})`);
  }
};

for (const [key, where] of used) checkKey(key, where);
for (const [pattern, where] of dynamicUsed) {
  const values = DYNAMIC[pattern];
  if (!values) {
    errors.push(`unknown dynamic key pattern "${pattern}" (${where}) — add its values to DYNAMIC`);
    continue;
  }
  for (const v of values) checkKey(pattern.replace('*', v), where);
}

// სტრუქტურა და ცვლადები
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const base = (k) => k.replace(/_(one|few|many|other)$/, '');
const vars = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}|<(\w+)>/g)].map((m) => m[1] || `<${m[2]}>`).sort().join(',');
const flat = Object.fromEntries(LANGS.map((l) => [l, flatten(locales[l])]));
const groups = Object.fromEntries(LANGS.map((l) => [l, new Map()]));
for (const l of LANGS) for (const [k, v] of flat[l]) groups[l].set(base(k), [...(groups[l].get(base(k)) || []), v]);
for (const k of groups.ka.keys()) {
  for (const l of ['en', 'ru']) {
    if (!groups[l].has(k)) errors.push(`${l}: missing "${k}" (present in ka)`);
    else if (vars(groups[l].get(k)[0]).replace('count', '') !== vars(groups.ka.get(k)[0]).replace('count', '')) {
      errors.push(`${l}: placeholders differ for "${k}": ka[${vars(groups.ka.get(k)[0])}] ${l}[${vars(groups[l].get(k)[0])}]`);
    }
  }
}
for (const l of ['en', 'ru']) for (const k of groups[l].keys()) if (!groups.ka.has(k)) errors.push(`${l}: extra "${k}" (not in ka)`);

if (errors.length) {
  console.error(`i18n check failed (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`i18n OK — ${used.size} static keys, ${dynamicUsed.size} dynamic patterns, ${groups.ka.size} entries × ${LANGS.length} languages`);
