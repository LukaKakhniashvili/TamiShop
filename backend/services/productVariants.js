const mongoose = require('mongoose');
const Product = require('../models/Product');
const httpError = require('../utils/httpError');
const { normalizeTranslations, OPTION_TRANSLATION_FIELDS, VALUE_TRANSLATION_FIELDS, TRANSLATION_LANGUAGES } = require('../utils/translations');

/*
 * ოფციები/ვარიანტები: ადმინის კონფიგურაციის ვალიდაცია, ვარიანტის ამოხსნა, მარაგის დაჯავშნა/დაბრუნება.
 * არქიტექტურა: Product → options → values → variants (ფასი / მარაგი / SKU / სტატუსი). იხ. models/Product.js
 */

const LIMITS = { options: 10, values: 50, variants: 500, name: 40, label: 40, sku: 64 };
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const { isValidObjectId } = mongoose;

const bad = (message, field = 'variants') => httpError(400, message, { code: 'INVALID_VARIANTS', field });
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const toId = (v) => (isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : new mongoose.Types.ObjectId());
const money = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/**
 * ადმინის მიერ გამოგზავნილი options/variants-ის ვალიდაცია და ნორმალიზაცია.
 * frontend-ი აგზავნის კლიენტზე შექმნილ _id-ებს, რომ ვარიანტებმა ახალ მნიშვნელობებზე მიუთითონ შენახვამდე.
 * @returns {{ options: object[], variants: object[] }}
 */
const normalizeVariantConfig = ({ options = [], variants = [] } = {}) => {
  if (!Array.isArray(options) || !Array.isArray(variants)) throw bad('ოფციების მონაცემები არასწორია');
  if (options.length > LIMITS.options) throw bad(`მაქსიმუმ ${LIMITS.options} ოფცია`, 'options');

  // ---- ოფციები და მნიშვნელობები
  const optionNames = new Set();
  const valueOwner = new Map(); // valueId -> optionIndex
  const normOptions = options.map((o, oi) => {
    const name = text(o?.name);
    if (!name) throw bad(`ოფცია #${oi + 1}: მიუთითეთ სახელი`, 'options');
    if (name.length > LIMITS.name) throw bad(`ოფციის სახელი „${name}" ძალიან გრძელია`, 'options');
    const key = name.toLocaleLowerCase();
    if (optionNames.has(key)) throw bad(`ოფცია „${name}" მეორდება`, 'options');
    optionNames.add(key);

    const values = Array.isArray(o.values) ? o.values : [];
    if (!values.length) throw bad(`ოფცია „${name}": დაამატეთ მინიმუმ ერთი მნიშვნელობა`, 'options');
    if (values.length > LIMITS.values) throw bad(`ოფცია „${name}": მაქსიმუმ ${LIMITS.values} მნიშვნელობა`, 'options');
    const labels = new Set();
    const display = o.display === 'swatch' ? 'swatch' : 'chip';
    const normValues = values.map((v, vi) => {
      const label = text(v?.label);
      if (!label) throw bad(`ოფცია „${name}": მნიშვნელობა #${vi + 1} ცარიელია`, 'options');
      if (label.length > LIMITS.label) throw bad(`მნიშვნელობა „${label}" ძალიან გრძელია`, 'options');
      const lk = label.toLocaleLowerCase();
      if (labels.has(lk)) throw bad(`ოფცია „${name}": მნიშვნელობა „${label}" მეორდება`, 'options');
      labels.add(lk);
      const color = text(v?.color);
      if (color && !HEX_COLOR.test(color)) throw bad(`„${label}": ფერი უნდა იყოს #RRGGBB ფორმატში`, 'options');
      const _id = toId(v?._id);
      if (valueOwner.has(String(_id))) throw bad('მნიშვნელობების იდენტიფიკატორები მეორდება', 'options');
      valueOwner.set(String(_id), oi);
      return {
        _id,
        label,
        color: display === 'swatch' && color ? color.toLowerCase() : null,
        translations: normalizeTranslations(v?.translations, VALUE_TRANSLATION_FIELDS),
      };
    });
    return {
      _id: toId(o?._id),
      name,
      required: o.required !== false,
      display,
      values: normValues,
      translations: normalizeTranslations(o?.translations, OPTION_TRANSLATION_FIELDS),
    };
  });

  if (!normOptions.length) {
    if (variants.length) throw bad('ვარიანტებისთვის ჯერ დაამატეთ ოფციები');
    return { options: [], variants: [] };
  }

  // ---- ვარიანტები
  if (!variants.length) throw bad('დაამატეთ მინიმუმ ერთი ვარიანტი (მნიშვნელობების კომბინაცია ფასით)');
  if (variants.length > LIMITS.variants) throw bad(`მაქსიმუმ ${LIMITS.variants} ვარიანტი`);

  const combos = new Set();
  const skus = new Set();
  const normVariants = variants.map((v, i) => {
    const n = i + 1;
    const ids = Array.isArray(v?.values) ? v.values.map(String) : [];
    const perOption = new Map();
    for (const id of ids) {
      if (!valueOwner.has(id)) throw bad(`ვარიანტი #${n}: მნიშვნელობა არ ეკუთვნის პროდუქტის ოფციებს`);
      const oi = valueOwner.get(id);
      if (perOption.has(oi)) throw bad(`ვარიანტი #${n}: ოფციიდან „${normOptions[oi].name}" მხოლოდ ერთი მნიშვნელობა`);
      perOption.set(oi, id);
    }
    normOptions.forEach((o, oi) => {
      if (o.required && !perOption.has(oi)) throw bad(`ვარიანტი #${n}: აირჩიეთ „${o.name}"`);
    });
    // კომბინაციის გასაღები ოფციების რიგით (არასავალდებულო ოფციის არარსებობა = „-")
    const key = normOptions.map((_, oi) => perOption.get(oi) || '-').join('|');
    if (combos.has(key)) throw bad(`ვარიანტი #${n}: ასეთი კომბინაცია უკვე არსებობს`);
    combos.add(key);

    const price = money(v.price);
    if (price === null || !Number.isFinite(price) || price < 0) throw bad(`ვარიანტი #${n}: ფასი უნდა იყოს 0 ან მეტი`);
    const oldPrice = money(v.oldPrice);
    if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice <= price)) {
      throw bad(`ვარიანტი #${n}: ძველი ფასი უნდა აღემატებოდეს მიმდინარე ფასს`);
    }
    const stock = v.stock === '' || v.stock === undefined || v.stock === null ? 0 : Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) throw bad(`ვარიანტი #${n}: მარაგი უნდა იყოს მთელი რიცხვი, 0 ან მეტი`);
    const sku = text(v.sku);
    if (sku.length > LIMITS.sku) throw bad(`ვარიანტი #${n}: SKU ძალიან გრძელია`);
    if (sku) {
      if (skus.has(sku.toLowerCase())) throw bad(`SKU „${sku}" მეორდება`);
      skus.add(sku.toLowerCase());
    }
    return {
      _id: toId(v?._id),
      // ოფციების რიგით დალაგებული
      values: normOptions.map((_, oi) => perOption.get(oi)).filter(Boolean).map((id) => new mongoose.Types.ObjectId(id)),
      price: Math.round(price * 100) / 100,
      oldPrice: oldPrice === null ? null : Math.round(oldPrice * 100) / 100,
      stock,
      sku,
      isActive: v.isActive !== false,
    };
  });

  return { options: normOptions, variants: normVariants };
};

/**
 * ვარიანტის აღწერა: [{ name: 'ფერი', value: 'შავი', translations? }, ...] — ოფციების რიგით (შეკვეთის snapshot-ისთვის).
 * translations = { en: { name, value }, ru: {...} } — მხოლოდ თუ ადმინს შეუვსია.
 */
const describeVariant = (product, variant) => {
  const ids = new Set((variant.values || []).map(String));
  return (product.options || []).flatMap((o) => {
    const v = o.values.find((x) => ids.has(String(x._id)));
    if (!v) return [];
    const translations = {};
    for (const lng of TRANSLATION_LANGUAGES) {
      const name = o.translations?.[lng]?.name;
      const value = v.translations?.[lng]?.label;
      if (name || value) translations[lng] = { ...(name ? { name } : {}), ...(value ? { value } : {}) };
    }
    return [{ name: o.name, value: v.label, ...(Object.keys(translations).length ? { translations } : {}) }];
  });
};

const findVariant = (product, variantId) =>
  isValidObjectId(variantId) ? (product.variants || []).find((v) => String(v._id) === String(variantId)) : undefined;

// ---------------------------------------------------------------------------
// მარაგი (მხოლოდ ვარიანტებზე; მარტივ პროდუქტს რაოდენობრივი მარაგი არ აქვს — მხოლოდ inStock)
// ---------------------------------------------------------------------------

/** შემაჯამებელი ველების (ფასი -დან, inStock) განახლება მარაგის ცვლილების შემდეგ */
const syncSummaries = async (productIds) => {
  const products = await Product.find({ _id: { $in: [...new Set(productIds.map(String))] } });
  await Promise.all(products.filter((p) => p.variants?.length).map((p) => p.save()));
};

/**
 * მარაგის ატომური დაჯავშნა (ვარიანტის ხაზებისთვის). თუ რომელიმე ხაზს არ ჰყოფნის — უკვე დაჯავშნილი
 * ბრუნდება და აბრუნებს { ok: false, line }. ორი ერთდროული შეკვეთა ბოლო ერთეულს ორჯერ ვერ გაყიდის.
 * @param {{ product, variantId, quantity }[]} lines
 */
const reserveStock = async (lines) => {
  const done = [];
  for (const line of lines.filter((l) => l.variantId)) {
    const vid = oid(line.variantId);
    const r = await Product.updateOne(
      { _id: line.product, variants: { $elemMatch: { _id: vid, isActive: { $ne: false }, stock: { $gte: line.quantity } } } },
      { $inc: { 'variants.$[v].stock': -line.quantity } },
      { arrayFilters: [{ 'v._id': vid }] }
    );
    if (!r.modifiedCount) {
      await releaseStock(done, { sync: false });
      return { ok: false, line };
    }
    done.push(line);
  }
  if (done.length) await syncSummaries(done.map((l) => l.product));
  return { ok: true };
};

/** დაჯავშნილი მარაგის დაბრუნება (მაგ. შეკვეთის გაუქმებისას). წაშლილ ვარიანტზე — არაფერი ხდება. */
const releaseStock = async (lines, { sync = true } = {}) => {
  const variantLines = lines.filter((l) => l.variantId);
  for (const line of variantLines) {
    const vid = oid(line.variantId);
    await Product.updateOne(
      { _id: line.product, 'variants._id': vid },
      { $inc: { 'variants.$[v].stock': line.quantity } },
      { arrayFilters: [{ 'v._id': vid }] }
    );
  }
  if (sync && variantLines.length) await syncSummaries(variantLines.map((l) => l.product));
};

/** შეკვეთის ხაზები → მარაგის ხაზები */
const orderStockLines = (order) =>
  (order.items || []).filter((i) => i.variant?.id).map((i) => ({ product: i.product, variantId: i.variant.id, quantity: i.quantity }));

module.exports = { normalizeVariantConfig, describeVariant, findVariant, reserveStock, releaseStock, orderStockLines, syncSummaries };
