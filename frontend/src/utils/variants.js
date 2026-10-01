/*
 * პროდუქტის ოფციები / ვარიანტები — კლიენტის ლოგიკა (არჩევანი → ვარიანტი, მნიშვნელობების ხელმისაწვდომობა).
 * სტრუქტურა (backend/models/Product.js):
 *   product.options  = [{ _id, name, required, display: 'chip'|'swatch', values: [{ _id, label, color }] }]
 *   product.variants = [{ _id, values: [valueId...], price, oldPrice, stock, sku, isActive }]
 * საბოლოო ფასს და მარაგს ყოველთვის ამოწმებს სერვერი შეკვეთის შექმნისას — აქ მხოლოდ UI-ისთვისაა.
 *
 * selection = { [optionId]: valueId }
 */

export const hasVariants = (p) => Boolean(p?.variants?.length);

/** კალათის ხაზის იდენტიფიკატორი: იგივე პროდუქტი + იგივე ვარიანტი = ერთი ხაზი */
export const cartLineId = (productId, variantId) => (variantId ? `${productId}:${variantId}` : String(productId));

const isActive = (v) => v.isActive !== false;
export const isAvailable = (v) => isActive(v) && v.stock > 0;

// ვარიანტის მნიშვნელობა მოცემულ ოფციაში (ან undefined)
const valueFor = (variant, option) => {
  const ids = new Set((variant.values || []).map(String));
  return option.values.find((v) => ids.has(String(v._id)))?._id;
};

/** ემთხვევა თუ არა ვარიანტი (ნაწილობრივ) არჩევანს — აურჩეველი ოფციები უგულებელყოფილია */
const matchesPartial = (product, variant, selection) =>
  product.options.every((o) => !selection[o._id] || String(valueFor(variant, o)) === String(selection[o._id]));

/** სრული არჩევანი → ზუსტი ვარიანტი (არასავალდებულო აურჩეველი ოფცია = ვარიანტს ის არ აქვს) */
export const resolveVariant = (product, selection) => {
  if (!hasVariants(product)) return null;
  if (product.options.some((o) => o.required && !selection[o._id])) return null;
  return (
    product.variants.find((v) =>
      product.options.every((o) => {
        const val = valueFor(v, o);
        return selection[o._id] ? String(val) === String(selection[o._id]) : val === undefined;
      })
    ) || null
  );
};

/** პირველი აუცილებელი, ჯერ აურჩეველი ოფცია */
export const firstMissingOption = (product, selection) => product.options.find((o) => o.required && !selection[o._id]) || null;

/**
 * მნიშვნელობის მდგომარეობა მიმდინარე არჩევანის გათვალისწინებით:
 *   'unavailable' — არცერთ აქტიურ ვარიანტში არ გვხვდება (გათიშული)
 *   'conflict'    — არსებობს, მაგრამ არა სხვა არჩეულ მნიშვნელობებთან ერთად (არჩევისას შეუთავსებელი არჩევანი იშლება)
 *   'soldout'     — თავსებადი ვარიანტები არსებობს, მაგრამ ყველა ამოწურულია
 *   'available'
 */
export const valueStatus = (product, selection, option, valueId) => {
  const active = product.variants.filter(isActive);
  const withValue = active.filter((v) => (v.values || []).map(String).includes(String(valueId)));
  if (!withValue.length) return 'unavailable';
  const compatible = withValue.filter((v) => matchesPartial(product, v, { ...selection, [option._id]: valueId }));
  if (!compatible.length) return 'conflict';
  return compatible.some((v) => v.stock > 0) ? 'available' : 'soldout';
};

/** მნიშვნელობის არჩევა: შეუთავსებელი სხვა არჩევანი ავტომატურად იშლება (ჩიხი არ წარმოიქმნება) */
export const selectValue = (product, selection, option, valueId) => {
  const next = { [option._id]: valueId };
  const active = product.variants.filter(isActive);
  for (const o of product.options) {
    if (o._id === option._id || !selection[o._id]) continue;
    const candidate = { ...next, [o._id]: selection[o._id] };
    if (active.some((v) => matchesPartial(product, v, candidate))) next[o._id] = selection[o._id];
  }
  return next;
};

/** ერთი მნიშვნელობის მქონე ოფციები წინასწარ არჩეულია */
export const initialSelection = (product) =>
  Object.fromEntries((product?.options || []).filter((o) => o.values.length === 1).map((o) => [o._id, o.values[0]._id]));

/**
 * ვარიანტის აღწერა: [{ name, value, translations? }] (ოფციების რიგით).
 * name/value — საბაზისო (ქართული); translations — { en: { name, value }, ru: {...} }, თუ ადმინს შეუვსია.
 * კალათა/შეკვეთა ინახავს ორივეს, რომ ენის შეცვლისას აღწერაც ითარგმნოს (components/LineOptions).
 */
export const describeVariant = (product, variant) =>
  product.options.flatMap((o) => {
    const id = valueFor(variant, o);
    const v = id && o.values.find((x) => String(x._id) === String(id));
    if (!v) return [];
    const translations = {};
    for (const lng of ['en', 'ru']) {
      const name = o.translations?.[lng]?.name;
      const value = v.translations?.[lng]?.label;
      if (name || value) translations[lng] = { ...(name ? { name } : {}), ...(value ? { value } : {}) };
    }
    return [{ name: o.name, value: v.label, ...(Object.keys(translations).length ? { translations } : {}) }];
  });

/** ფასების დიაპაზონი აქტიური ვარიანტებიდან */
export const priceRange = (product) => {
  const prices = product.variants.filter(isActive).map((v) => v.price);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: product.price, max: product.price };
};

/** ახალი (კლიენტზე შექმნილი) იდენტიფიკატორი — 24 hex, რომ სერვერმა ObjectId-ად მიიღოს */
export const newId = () =>
  Math.floor(Date.now() / 1000).toString(16).padStart(8, '0') +
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
