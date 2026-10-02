const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const { nameTranslations } = require('../../utils/translations');
const { staffUserIds, qualifiedOrderMatch, isCompletedExpr, lineTotalExpr, sumIf, round2 } = require('./base');

/*
 * პროდუქტები:
 *   ბესტსელერები — რეალურად გაყიდული ერთეულები კვალიფიციურ შეკვეთებში (არა რეიტინგი / შეფასებები / რეკომენდაცია);
 *   შემოსავლით — items.price × quantity (ფასის snapshot შეკვეთის მომენტში);
 *   სუსტი პროდუქტები — აქტიური პროდუქტები, რომლებიც მთელი პერიოდის განმავლობაში იყიდებოდა და 0 ერთეული გაიყიდა.
 * წაშლილი პროდუქტი ისტორიაში რჩება შეკვეთის snapshot-ის სახელით (deleted: true).
 */

const MAX_LIMIT = 20;
const limitOf = (v, d = 10) => Math.min(MAX_LIMIT, Math.max(1, parseInt(v, 10) || d));

const productInfo = (p) =>
  p && { name: p.name, translations: nameTranslations(p), slug: p.slug, image: p.image || p.images?.[0] || '', isActive: p.isActive !== false, inStock: !!p.inStock };

const products = async (range, { limit } = {}) => {
  const n = limitOf(limit);
  const staffIds = await staffUserIds();

  const [facet] = await Order.aggregate([
    { $match: qualifiedOrderMatch({ start: range.start, end: range.end, staffIds }) },
    { $unwind: '$items' },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$items.product',
        snapshotName: { $last: '$items.name' },
        snapshotTranslations: { $last: '$items.translations' },
        units: { $sum: '$items.quantity' },
        value: { $sum: lineTotalExpr },
        revenue: sumIf(isCompletedExpr, lineTotalExpr),
        orders: { $addToSet: '$_id' },
      },
    },
    { $addFields: { orders: { $size: '$orders' } } },
    {
      $facet: {
        byUnits: [{ $sort: { units: -1, value: -1, _id: 1 } }, { $limit: n }],
        byRevenue: [{ $sort: { revenue: -1, value: -1, _id: 1 } }, { $limit: n }],
        sold: [{ $project: { _id: 1 } }],
        totals: [{ $group: { _id: null, products: { $sum: 1 }, units: { $sum: '$units' } } }],
      },
    },
  ]);

  const soldIds = (facet?.sold || []).map((r) => r._id);
  // სუსტი: აქტიური, პერიოდის დაწყებამდე დამატებული (მთელი პერიოდი იყიდებოდა), 0 გაყიდვა
  const lowFilter = { isActive: true, createdAt: { $lt: range.start }, _id: { $nin: soldIds } };
  const [lowRows, lowTotal] = await Promise.all([
    Product.find(lowFilter).sort({ createdAt: 1, _id: 1 }).limit(n).select('name translations slug image images isActive inStock createdAt').lean(),
    Product.countDocuments(lowFilter),
  ]);

  // ერთი მოთხოვნა ყველა საჭირო პროდუქტზე (N+1-ის გარეშე)
  const ids = [...new Set([...(facet?.byUnits || []), ...(facet?.byRevenue || [])].map((r) => String(r._id)))];
  const [current, wishCounts] = await Promise.all([
    Product.find({ _id: { $in: ids } }).select('name translations slug image images isActive inStock').lean(),
    // მიმდინარე რჩეულები სუსტ პროდუქტებზე (კონტექსტისთვის) — პერსონალის გარეშე
    lowRows.length
      ? User.aggregate([
          { $match: { _id: { $nin: staffIds }, 'wishlist.product': { $in: lowRows.map((p) => p._id) } } },
          { $unwind: '$wishlist' },
          { $match: { 'wishlist.product': { $in: lowRows.map((p) => p._id) } } },
          { $group: { _id: '$wishlist.product', n: { $sum: 1 } } },
        ])
      : [],
  ]);
  const byId = new Map(current.map((p) => [String(p._id), p]));
  const wish = new Map(wishCounts.map((r) => [String(r._id), r.n]));

  const row = (r) => {
    const p = byId.get(String(r._id));
    return {
      productId: r._id,
      ...(p ? productInfo(p) : { name: r.snapshotName, translations: r.snapshotTranslations, slug: null, image: '', isActive: false, inStock: false }),
      deleted: !p,
      units: r.units,
      orders: r.orders,
      value: round2(r.value),
      revenue: round2(r.revenue),
    };
  };

  return {
    bestSellers: (facet?.byUnits || []).map(row),
    topRevenue: (facet?.byRevenue || []).filter((r) => r.revenue > 0).map(row),
    lowPerformers: lowRows.map((p) => ({ productId: p._id, ...productInfo(p), listedSince: p.createdAt, wishlisted: wish.get(String(p._id)) || 0 })),
    lowPerformersTotal: lowTotal,
    totals: { productsSold: facet?.totals?.[0]?.products || 0, units: facet?.totals?.[0]?.units || 0 },
  };
};

module.exports = { products, limitOf };
