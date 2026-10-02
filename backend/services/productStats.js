const Order = require('../models/Order');
const { CONFIRMED_ORDER_MATCH } = require('../constants/orderStatus');

/*
 * პროდუქტის სტატუსების ერთიანი ბიზნეს-წესები. ფასების სტრუქტურა:
 *   price    — მიმდინარე (საბოლოო) გასაყიდი ფასი
 *   oldPrice — თავდაპირველი ფასი, როცა პროდუქტი ფასდაკლებაშია
 *   onSale   — ფასდაკლების ნიშანი
 * ყველა წესი არსებობს ორ ფორმაში — MongoDB expression (ფილტრაცია/სორტირება ბაზაში) და
 * JS ფუნქცია (უკვე ჩატვირთული პროდუქტებისთვის) — ერთი და იგივე ფორმულით.
 */

// ახალია პროდუქტი, რომელიც დაემატა ბოლო 14 დღის განმავლობაში (ჩათვლით)
const NEW_PRODUCT_DAYS = 14;
const newSinceDate = (now = Date.now()) => new Date(now - NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000);
const isNewProduct = (p, now = Date.now()) => new Date(p.createdAt) >= newSinceDate(now);
const isNewExpr = (now) => ({ $gte: ['$createdAt', newSinceDate(now)] });

// აქტიური ფასდაკლება: onSale და თავდაპირველი ფასი მიმდინარეზე მეტია
const hasDiscountExpr = { $and: ['$onSale', { $gt: ['$oldPrice', 0] }, { $gt: ['$oldPrice', '$price'] }] };
const hasDiscount = (p) => Boolean(p.onSale && p.oldPrice > 0 && p.oldPrice > p.price);

// ფასდაკლების პროცენტი — ქვემოთ დამრგვალებული მთელი რიცხვი, რომ ბეჯი არასდროს აჭარბებდეს
// რეალურ ფასდაკლებას (39.6% => 39%). EPSILON — float-ის ცდომილებისთვის (მაგ. 100→60 = ზუსტად 40%).
const EPSILON = 1e-9;
const discountPercentExpr = {
  $cond: [
    hasDiscountExpr,
    { $floor: { $add: [{ $multiply: [{ $divide: [{ $subtract: ['$oldPrice', '$price'] }, '$oldPrice'] }, 100] }, EPSILON] } },
    0,
  ],
};
const discountPercent = (p) => (hasDiscount(p) ? Math.floor(((p.oldPrice - p.price) / p.oldPrice) * 100 + EPSILON) : 0);

// ვარიანტიანი პროდუქტი: hasVariants და ფასების დიაპაზონი (აქტიური ვარიანტებიდან) — ბარათზე „-დან" ფასისთვის
const activeVariantsExpr = {
  $filter: { input: { $ifNull: ['$variants', []] }, as: 'v', cond: { $ne: ['$$v.isActive', false] } },
};
const variantFieldsExpr = {
  hasVariants: { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] },
  priceMax: { $ifNull: [{ $max: { $map: { input: activeVariantsExpr, as: 'v', in: '$$v.price' } } }, '$price'] },
};
const variantFields = (p) => {
  const active = (p.variants || []).filter((v) => v.isActive !== false);
  return {
    hasVariants: Boolean(p.variants?.length),
    priceMax: active.length ? Math.max(...active.map((v) => v.price)) : p.price,
  };
};

// გამოთვლილი ველები, რომლებსაც API ყველა პროდუქტს უმატებს
const computedFieldsStage = (now = Date.now()) => ({
  $addFields: { discountPercent: discountPercentExpr, isNew: isNewExpr(now), ...variantFieldsExpr },
});
const withComputedFields = (p, now = Date.now()) => ({
  ...p,
  discountPercent: discountPercent(p),
  isNew: isNewProduct(p, now),
  ...variantFields(p),
});

/**
 * გაყიდული ერთეულები თითო პროდუქტზე: მხოლოდ დადასტურებული შეკვეთები (ბარათით გადაუხდელი მცდელობა
 * არ ითვლება — CONFIRMED_ORDER_MATCH), გაუქმებულების გარეშე.
 * @param {object} [match] დამატებითი ფილტრი შეკვეთებზე (მაგ. { user: id } ან თარიღის დიაპაზონი)
 * @returns {Promise<Map<string, number>>} productId -> გაყიდული რაოდენობა, კლებადობით
 */
const getSalesCounts = async (match = {}) => {
  const rows = await Order.aggregate([
    { $match: { $and: [{ status: { $ne: 'cancelled' } }, CONFIRMED_ORDER_MATCH, match] } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', units: { $sum: '$items.quantity' } } },
    { $sort: { units: -1 } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.units]));
};

module.exports = {
  NEW_PRODUCT_DAYS,
  newSinceDate,
  hasDiscountExpr,
  discountPercentExpr,
  discountPercent,
  computedFieldsStage,
  withComputedFields,
  getSalesCounts,
};
