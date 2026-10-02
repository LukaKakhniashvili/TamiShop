const Order = require('../../models/Order');
const { ORDER_STATUSES } = require('../../constants/orderStatus');
const { nameTranslations } = require('../../utils/translations');
const { truncExpr, fillSeries } = require('./range');
const {
  staffUserIds,
  businessOrderMatch,
  qualifiedOrderMatch,
  isCompletedExpr,
  isOpenExpr,
  lineTotalExpr,
  sumIf,
  round2,
  change,
  ratio,
} = require('./base');

/*
 * გაყიდვები: KPI-ები (მიმდინარე + წინა პერიოდი), დროითი სერია, სტატუსები, გადახდის მეთოდები, კატეგორიები.
 * ყველა წესი — base.js (კვალიფიციური / რეალიზებული / ღია / პერსონალის გამორიცხვა).
 */

// ---------------------------------------------------------------- KPI

const kpiGroup = {
  revenue: sumIf(isCompletedExpr, '$totalPrice'),
  completedOrders: sumIf(isCompletedExpr),
  openValue: sumIf(isOpenExpr, '$totalPrice'),
  openOrders: sumIf(isOpenExpr),
  orders: { $sum: 1 },
  orderValue: { $sum: '$totalPrice' },
  customers: { $addToSet: '$user' },
};

const shapeKpis = (row) => {
  const r = row || {};
  const orders = r.orders || 0;
  const orderValue = round2(r.orderValue);
  return {
    revenue: round2(r.revenue),
    completedOrders: r.completedOrders || 0,
    openValue: round2(r.openValue),
    openOrders: r.openOrders || 0,
    orders,
    orderValue,
    // AOV — კვალიფიციური შეკვეთის საშუალო ღირებულება (კალათის ზომა), არა რეალიზებული შემოსავალი / შეკვეთა
    aov: orders ? round2(orderValue / orders) : null,
    customers: (r.customers || []).length,
  };
};

/** KPI-ები მიმდინარე და წინა პერიოდისთვის — ერთი აგრეგაციით */
const summary = async (range) => {
  const staffIds = await staffUserIds();
  const rows = await Order.aggregate([
    { $match: qualifiedOrderMatch({ start: range.prevStart, end: range.end, staffIds }) },
    { $addFields: { period: { $cond: [{ $gte: ['$createdAt', range.start] }, 'current', { $cond: [{ $lt: ['$createdAt', range.prevEnd] }, 'previous', 'gap'] }] } } },
    { $match: { period: { $in: ['current', 'previous'] } } },
    { $group: { _id: '$period', ...kpiGroup } },
  ]);
  const current = shapeKpis(rows.find((r) => r._id === 'current'));
  const previous = shapeKpis(rows.find((r) => r._id === 'previous'));
  const changes = Object.fromEntries(Object.keys(current).map((k) => [k, change(current[k] ?? 0, previous[k] ?? 0)]));
  return { current, previous, change: changes };
};

// ---------------------------------------------------------------- sales

const sales = async (range) => {
  const staffIds = await staffUserIds();
  const business = businessOrderMatch({ start: range.start, end: range.end, staffIds });
  const qualified = qualifiedOrderMatch({ start: range.start, end: range.end, staffIds });

  const [seriesRows, statusRows, paymentRows, categoryRows] = await Promise.all([
    // შემოსავალი / ღია ღირებულება / შეკვეთები დროში
    Order.aggregate([
      { $match: qualified },
      {
        $group: {
          _id: truncExpr('$createdAt', range.granularity),
          revenue: sumIf(isCompletedExpr, '$totalPrice'),
          openValue: sumIf(isOpenExpr, '$totalPrice'),
          orders: { $sum: 1 },
          completedOrders: sumIf(isCompletedExpr),
        },
      },
    ]),
    // სტატუსები (გაუქმებულის ჩათვლით)
    Order.aggregate([{ $match: business }, { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalPrice' } } }]),
    // გადახდის მეთოდები — კვალიფიციურ შეკვეთებზე; ძველ შეკვეთებს მეთოდი არ აქვს → unknown
    Order.aggregate([
      { $match: qualified },
      {
        $group: {
          _id: { $ifNull: ['$payment.method', 'unknown'] },
          orders: { $sum: 1 },
          value: { $sum: '$totalPrice' },
          revenue: sumIf(isCompletedExpr, '$totalPrice'),
        },
      },
    ]),
    // კატეგორიები: snapshot (ზუსტი) → არა და პროდუქტის მიმდინარე კატეგორია (შეფასებითი) → უცნობი
    Order.aggregate([
      { $match: qualified },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', pipeline: [{ $project: { category: 1 } }], as: 'p' } },
      {
        $addFields: {
          catId: { $ifNull: ['$items.category.id', { $first: '$p.category' }] },
          estimated: { $and: [{ $not: ['$items.category.id'] }, { $gt: [{ $size: '$p' }, 0] }] },
          lineTotal: lineTotalExpr,
        },
      },
      {
        $group: {
          _id: '$catId',
          snapshotName: { $last: '$items.category.name' },
          snapshotTranslations: { $last: '$items.category.translations' },
          units: { $sum: '$items.quantity' },
          value: { $sum: '$lineTotal' },
          revenue: sumIf(isCompletedExpr, '$lineTotal'),
          estimatedValue: sumIf('$estimated', '$lineTotal'),
        },
      },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', pipeline: [{ $project: { name: 1, translations: 1 } }], as: 'c' } },
      { $sort: { value: -1 } },
    ]),
  ]);

  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  const values = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  statusRows.forEach((r) => {
    counts[r._id] = r.count;
    values[r._id] = round2(r.value);
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const totalCategoryValue = categoryRows.reduce((a, r) => a + r.value, 0);
  return {
    series: fillSeries(range, seriesRows, { revenue: 0, openValue: 0, orders: 0, completedOrders: 0 }).map((p) => ({
      ...p,
      revenue: round2(p.revenue),
      openValue: round2(p.openValue),
    })),
    status: {
      total,
      counts,
      values,
      // გაუქმების წილი — ყველა ბიზნეს-შეკვეთიდან; დასრულების წილი — დახურული (დასრულებული + გაუქმებული) შეკვეთებიდან
      cancellationRate: ratio(counts.cancelled, total),
      completionRate: ratio(counts.completed, counts.completed + counts.cancelled),
      open: counts.pending + counts.processing + counts.shipped,
    },
    payments: paymentRows
      .map((r) => ({ method: r._id, orders: r.orders, value: round2(r.value), revenue: round2(r.revenue) }))
      .sort((a, b) => b.orders - a.orders),
    categories: categoryRows.map((r) => ({
      categoryId: r._id || null,
      name: r.c?.[0]?.name || r.snapshotName || null, // null → UI: „უცნობი კატეგორია"
      translations: nameTranslations(r.c?.[0]) || r.snapshotTranslations,
      deleted: !!r._id && !r.c?.length,
      units: r.units,
      value: round2(r.value),
      revenue: round2(r.revenue),
      share: ratio(r.value, totalCategoryValue),
      estimatedValue: round2(r.estimatedValue),
      estimated: r.estimatedValue > 0,
    })),
  };
};

module.exports = { summary, sales };
