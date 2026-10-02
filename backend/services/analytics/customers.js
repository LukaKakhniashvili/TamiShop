const Order = require('../../models/Order');
const User = require('../../models/User');
const { staffUserIds, businessOrderMatch, isCompletedExpr, sumIf, round2, change, maskEmail } = require('./base');

/*
 * მომხმარებლები (კვალიფიციური შეკვეთებით; პერსონალის გარეშე):
 *   მყიდველი             — პერიოდში ≥1 კვალიფიციური შეკვეთა
 *   ახალი მყიდველი        — პირველი კვალიფიციური შეკვეთა ამ პერიოდშია
 *   დაბრუნებული მყიდველი  — პერიოდში ≥1 შეკვეთა და პერიოდის დაწყებამდეც ≥1 (ახალი + დაბრუნებული = ყველა მყიდველი)
 *   ახალი რეგისტრაცია     — User.createdAt პერიოდში (role = customer)
 *   ტოპ მყიდველები        — რეალიზებული შემოსავლით; ელ-ფოსტა ნიღბით, ტელეფონი/მისამართი არასდროს
 */

const TOP_LIMIT = 10;

const customers = async (range) => {
  const staffIds = await staffUserIds();

  // ერთი გავლა: ყველა კვალიფიციური შეკვეთა პერიოდის ბოლომდე, დაჯგუფებული მომხმარებლით
  const inPeriod = { $and: [{ $gte: ['$createdAt', range.start] }, { $lt: ['$createdAt', range.end] }] };
  const rows = await Order.aggregate([
    { $match: { $and: [businessOrderMatch({ end: range.end, staffIds }), { status: { $ne: 'cancelled' } }] } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$user',
        firstAt: { $min: '$createdAt' },
        before: sumIf({ $lt: ['$createdAt', range.start] }),
        orders: sumIf(inPeriod),
        value: sumIf(inPeriod, '$totalPrice'),
        revenue: sumIf({ $and: [inPeriod, isCompletedExpr] }, '$totalPrice'),
        lastAt: { $max: '$createdAt' },
        // სახელი შეკვეთიდან — თუ მომხმარებელი წაიშალა
        firstName: { $last: '$customerInfo.firstName' },
        lastName: { $last: '$customerInfo.lastName' },
      },
    },
    { $match: { orders: { $gt: 0 } } },
  ]);

  const purchasing = rows.length;
  const newCustomers = rows.filter((r) => r.firstAt >= range.start).length;
  const returning = rows.filter((r) => r.before > 0).length;
  const totalOrders = rows.reduce((a, r) => a + r.orders, 0);

  const top = [...rows].sort((a, b) => b.revenue - a.revenue || b.value - a.value || b.orders - a.orders).slice(0, TOP_LIMIT);
  const [users, registrations, prevRegistrations] = await Promise.all([
    User.find({ _id: { $in: top.map((r) => r._id) } }).select('firstName lastName email isActive').lean(),
    User.countDocuments({ role: 'customer', createdAt: { $gte: range.start, $lt: range.end } }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: range.prevStart, $lt: range.prevEnd } }),
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return {
    purchasing,
    newCustomers,
    returning,
    returningRate: purchasing ? round2((returning / purchasing) * 100) : null,
    avgOrdersPerCustomer: purchasing ? round2(totalOrders / purchasing) : null,
    registrations,
    registrationsChange: change(registrations, prevRegistrations),
    prevRegistrations,
    top: top.map((r) => {
      const u = byId.get(String(r._id));
      const name = u ? `${u.firstName || ''} ${u.lastName ? `${u.lastName[0]}.` : ''}`.trim() : `${r.firstName || ''} ${r.lastName ? `${r.lastName[0]}.` : ''}`.trim();
      return {
        // შიდა id არ ბრუნდება — მხოლოდ რიგის გასაღები
        key: String(r._id).slice(-8),
        name: name || null,
        email: u ? maskEmail(u.email) : null,
        deleted: !u,
        inactive: !!u && u.isActive === false,
        orders: r.orders,
        value: round2(r.value),
        revenue: round2(r.revenue),
        lastOrderAt: r.lastAt,
        returning: r.before > 0,
      };
    }),
  };
};

module.exports = { customers };
