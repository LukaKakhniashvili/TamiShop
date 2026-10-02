const Review = require('../../models/Review');
const Product = require('../../models/Product');
const { truncExpr, fillSeries } = require('./range');
const { nameTranslations } = require('../../utils/translations');
const { staffUserIds, dateMatch, round2, change } = require('./base');

/*
 * შეფასებები (შექმნის თარიღით პერიოდში; პერსონალის შეფასებების გარეშე):
 *   ბიზნეს-მეტრიკები — მხოლოდ published; დამალული — ცალკე, მოდერაციის მაჩვენებლად.
 *   მაღალი / დაბალი რეიტინგი — მინიმუმ MIN_REVIEWS შეფასება, დალაგება ბაიესის საშუალოთი:
 *     score = (v·R + m·C) / (v + m),  v — პროდუქტის შეფასებები, R — მისი საშუალო,
 *     m = BAYES_M, C — ყველა გამოქვეყნებული შეფასების საშუალო პერიოდში.
 *   ერთი 5★ შეფასება სიას ვერ „დაიკავებს"; ნაჩვენებია ნედლი საშუალო და რაოდენობაც.
 * შენიშვნა: მომხმარებლის მიერ წაშლილი შეფასება ისტორიიდანაც ქრება.
 */

const MIN_REVIEWS = 3;
const BAYES_M = 3;
const TOP_LIMIT = 10;

const reviews = async (range) => {
  const staffIds = await staffUserIds();
  const base = { user: { $nin: staffIds } };
  const published = { ...base, status: 'published', ...dateMatch(range.start, range.end) };

  const [[facet], prevCount, hidden] = await Promise.all([
    Review.aggregate([
      { $match: published },
      {
        $facet: {
          totals: [{ $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' }, verified: { $sum: { $cond: ['$verifiedPurchase', 1, 0] } } } }],
          distribution: [{ $group: { _id: '$rating', count: { $sum: 1 } } }],
          series: [{ $group: { _id: truncExpr('$createdAt', range.granularity), count: { $sum: 1 }, avg: { $avg: '$rating' } } }],
          products: [{ $group: { _id: '$product', count: { $sum: 1 }, avg: { $avg: '$rating' } } }],
        },
      },
    ]),
    Review.countDocuments({ ...base, status: 'published', ...dateMatch(range.prevStart, range.prevEnd) }),
    Review.countDocuments({ ...base, status: 'hidden', ...dateMatch(range.start, range.end) }),
  ]);

  const totals = facet?.totals?.[0];
  const count = totals?.count || 0;
  const C = totals?.avg || 0;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (facet?.distribution || []).forEach((r) => {
    distribution[r._id] = r.count;
  });

  const perProduct = (facet?.products || []).map((r) => ({
    productId: r._id,
    count: r.count,
    avg: round2(r.avg),
    score: round2((r.count * r.avg + BAYES_M * C) / (r.count + BAYES_M)),
  }));
  const eligible = perProduct.filter((r) => r.count >= MIN_REVIEWS);
  const mostReviewed = [...perProduct].sort((a, b) => b.count - a.count || b.avg - a.avg).slice(0, TOP_LIMIT);
  const highest = [...eligible].sort((a, b) => b.score - a.score || b.count - a.count).slice(0, TOP_LIMIT);
  const lowest = [...eligible].sort((a, b) => a.score - b.score || b.count - a.count).slice(0, TOP_LIMIT);

  const ids = [...new Set([...mostReviewed, ...highest, ...lowest].map((r) => String(r.productId)))];
  const productsById = new Map(
    (await Product.find({ _id: { $in: ids } }).select('name translations slug image images isActive').lean()).map((p) => [String(p._id), p])
  );
  const withProduct = (r) => {
    const p = productsById.get(String(r.productId));
    return { ...r, name: p?.name || null, translations: nameTranslations(p), slug: p?.slug || null, image: p?.image || p?.images?.[0] || '', isActive: p ? p.isActive !== false : false };
  };

  return {
    count,
    prevCount,
    countChange: change(count, prevCount),
    average: count ? round2(C) : null,
    verified: totals?.verified || 0,
    hidden,
    distribution,
    series: fillSeries(range, facet?.series || [], { count: 0, avg: null }).map((p) => ({ ...p, avg: p.avg == null ? null : round2(p.avg) })),
    rules: { minReviews: MIN_REVIEWS, bayesM: BAYES_M },
    rankedProducts: eligible.length,
    mostReviewed: mostReviewed.map(withProduct),
    highest: highest.map(withProduct),
    lowest: lowest.map(withProduct),
  };
};

module.exports = { reviews, MIN_REVIEWS, BAYES_M };
