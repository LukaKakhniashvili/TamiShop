/*
 * პროდუქტების ძიება სამივე ენაზე (ka / en / ru).
 *   — ეძებს სახელში, აღწერაში და მახასიათებლების მნიშვნელობებში ყველა ენაზე (საბაზისო + translations.en/ru)
 *   — კატეგორიის სახელის დამთხვევისას (ნებისმიერ ენაზე) შედის ამ კატეგორიის პროდუქტებიც
 *   — მცირე სინონიმების ცხრილი ენებს შორის (ტელეფონი ↔ smartphone ↔ телефон...), რომ ერთი ცნება სამივე ენაზე მოიძებნოს
 * მომხმარებლის ტექსტი regex-ისთვის escape-დება.
 */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ერთი ცნების ფუძეები სამ ენაზე (რეგისტრის გარეშე). ქართული/რუსული ფუძე ემთხვევა სიტყვის დასაწყისს
// (ბოლოსართები ცვალებადია), ლათინური — ქვესტრიქონს. (?!...) — გამონაკლისი (მაგ. „საათი"/„საათები", მაგრამ არა „საათიანი").
const SYNONYM_GROUPS = [
  ['ტელეფონ', 'სმარტფონ', 'მობილურ', 'phone', 'smartphone', 'mobile', 'телефон', 'смартфон', 'мобильн'],
  ['ლეპტოპ', 'ნოუთბუქ', 'კომპიუტერ', 'laptop', 'notebook', 'computer', 'macbook', 'ноутбук', 'компьютер'],
  ['პლანშეტ', 'tablet', 'ipad', 'планшет'],
  ['ყურსასმენ', 'headphone', 'earphone', 'earbud', 'airpods', 'наушник'],
  ['დინამიკ', 'speaker', 'колонк', 'динамик'],
  ['საათ(?:ი(?![\u10D0-\u10FF])|ებ)', 'watch', 'часы'],
  ['ფეხსაცმელ', 'სნიკერ', 'ლოდოჩკ', 'shoe', 'sneaker', 'heels', 'pumps', 'обув', 'кроссовк', 'туфл'],
  ['კაბა', 'dress', 'gown', 'плать'],
  ['პერანგ', 'shirt', 'рубашк'],
  ['მაისურ', 't-shirt', 'футболк'],
  ['ჩანთ', 'ზურგჩანთ', 'bag', 'backpack', 'сумк', 'рюкзак'],
  ['სათვალე', 'glasses', 'sunglasses', 'очки'],
  ['სუნამო', 'perfume', 'parfum', 'fragrance', 'парфюм', 'аромат', 'духи'],
  ['ბურთ', 'ball', 'мяч'],
  ['ავეჯ', 'furniture', 'sofa', 'chair', 'мебел', 'диван', 'кресл'],
  ['ბლენდერ', 'blender', 'блендер'],
  ['ქვაბ', 'saucepan', 'кастрюл'],
  ['დანა', 'knife', 'нож'],
  ['მცენარე', 'plant', 'растени'],
  ['ლამპა', 'განათება', 'lamp', 'lighting', 'ламп', 'освещени'],
  ['მაკიაჟ', 'პომად', 'ტუში', 'makeup', 'lipstick', 'mascara', 'макияж', 'помад', 'тушь'],
];

const NON_LATIN = /[ა-ჿЀ-ӿ]/;
// ფუძე regex-ის ნაწილების გარეშე (ჯგუფის აქტივაციის შესამოწმებლად): „საათ(?:ი...)" → „საათ"
const plainStem = (stem) => stem.replace(/\(.*$/, '');
// ქართული/კირილიცა: სიტყვის დასაწყისი (წინ არ დგას ასო ან ციფრი).
// MongoDB-ის PCRE \p{L}-სა და \uXXXX-ს არ იღებს — ამიტომ ლიტერალური დიაპაზონები.
const WORD_CHARS = 'ა-ჰa-zA-Zа-яА-ЯёЁ0-9';
const stemRegex = (stem) => (NON_LATIN.test(stem) ? new RegExp(`(^|[^${WORD_CHARS}])${stem}`, 'i') : new RegExp(stem, 'i'));

/** საძიებო ტექსტი → regex-ების სია (ორიგინალი + სინონიმები) */
const searchPatterns = (search) => {
  const q = String(search || '').trim().slice(0, 100);
  if (!q) return [];
  const lower = q.toLocaleLowerCase();
  const patterns = [stemRegex(escapeRegex(q))];
  // სინონიმები მხოლოდ ერთსიტყვიან მოთხოვნაზე („ტელეფონი", „phone") — კონკრეტული ფრაზა
  // („iPhone 13 Pro 256GB") ზუსტად იძებნება და ყველა ტელეფონს არ აბრუნებს
  if (/\s/.test(q)) return patterns;
  for (const group of SYNONYM_GROUPS) {
    // ჯგუფი აქტიურდება, თუ ფუძე შედის მოთხოვნაში (ან მოთხოვნა — ფუძის დასაწყისია, მინ. 3 სიმბოლო)
    const hit = group.some((stem) => {
      const p = plainStem(stem);
      return lower.includes(p) || (lower.length >= 3 && p.startsWith(lower));
    });
    if (hit) patterns.push(...group.map(stemRegex));
  }
  return patterns;
};

const LOCALIZED_FIELDS = [
  'name',
  'description',
  'specifications.value',
  'translations.en.name',
  'translations.ru.name',
  'translations.en.description',
  'translations.ru.description',
  'translations.en.specifications.value',
  'translations.ru.specifications.value',
];

/**
 * @param search       მომხმარებლის ტექსტი
 * @param CategoryModel Category მოდელი (კატეგორიის სახელით ძიებისთვის)
 * @returns {Promise<object|null>} MongoDB პირობა ($or) ან null
 */
const buildProductSearchFilter = async (search, CategoryModel) => {
  const patterns = searchPatterns(search);
  if (!patterns.length) return null;
  const or = LOCALIZED_FIELDS.flatMap((field) => patterns.map((re) => ({ [field]: re })));
  // კატეგორია — მხოლოდ თუ მისი სახელი (ნებისმიერ ენაზე) იწყება მოთხოვნით („Electronics", „Одежда"...)
  const q = String(search).trim();
  const starts = new RegExp(`^${escapeRegex(q)}`, 'i');
  const categoryIds =
    q.length >= 3
      ? await CategoryModel.find({ $or: ['name', 'translations.en.name', 'translations.ru.name'].map((field) => ({ [field]: starts })) }).distinct('_id')
      : [];
  if (categoryIds.length) or.push({ category: { $in: categoryIds } });
  return { $or: or };
};

// სახელით სორტირება არჩეულ ენაზე (თარგმანის არარსებობისას — ქართული სახელი)
const localizedNameExpr = (lng) => (lng === 'ka' ? '$name' : { $ifNull: [`$translations.${lng}.name`, '$name'] });
// ICU collation: ქართული ანბანი Unicode-ში ანბანური რიგითაა, ამიტომ ka-სთვისაც საკმარისია ზოგადი წესები
const collationFor = (lng) => ({ locale: lng === 'ru' ? 'ru' : 'en', strength: 2 });

module.exports = { escapeRegex, searchPatterns, buildProductSearchFilter, localizedNameExpr, collationFor, SYNONYM_GROUPS };
