const User = require('../../models/User');
const { CONFIRMED_ORDER_MATCH, IN_PROGRESS_STATUSES } = require('../../constants/orderStatus');

/*
 * ბიზნეს-ანალიტიკის საერთო წესები — ყველა სერვისი მხოლოდ ამათ იყენებს (განმარტებები არ მეორდება).
 *
 *   ბიზნეს-შეკვეთა      = დადასტურებული (CONFIRMED_ORDER_MATCH: კურიერთან / ძველი — ყოველთვის; ბარათი — მხოლოდ გადახდილი)
 *                          + არ ეკუთვნის ადმინს/მენეჯერს (მიმდინარე როლით). ნებისმიერი სტატუსი — სტატუსების განაწილებისთვის.
 *   კვალიფიციური        = ბიზნეს-შეკვეთა, რომელიც არ არის გაუქმებული.
 *   რეალიზებული          = კვალიფიციური, status = completed (თანხა მიღებულია). → შემოსავალი
 *   ღია (მოსალოდნელი)    = კვალიფიციური, status ∈ pending | processing | shipped. → ღია შეკვეთების ღირებულება
 *   ღირებულება            = order.totalPrice (itemsTotal + მიწოდება); პროდუქტის დონეზე — items.price × quantity (snapshot)
 *   თარიღი                = order.createdAt (შეკვეთის განთავსება), Asia/Tbilisi, [start, end)
 */

const STAFF_ROLES = ['admin', 'manager'];
const COMPLETED = 'completed';
const OPEN_STATUSES = IN_PROGRESS_STATUSES;

/** ადმინის/მენეჯერის ანგარიშები (დეაქტივირებულების ჩათვლით) — მათი შეკვეთები/შეფასებები ბიზნეს-მეტრიკებში არ შედის */
const staffUserIds = () => User.find({ role: { $in: STAFF_ROLES } }).distinct('_id');

const dateMatch = (start, end, field = 'createdAt') => ({ [field]: { $gte: start, $lt: end } });

/** ბიზნეს-შეკვეთები (ნებისმიერი სტატუსი) */
const businessOrderMatch = ({ start, end, staffIds }) => ({
  $and: [CONFIRMED_ORDER_MATCH, { user: { $nin: staffIds } }, ...(start ? [dateMatch(start, end)] : [{ createdAt: { $lt: end } }])],
});

/** კვალიფიციური შეკვეთები (გაუქმების გარეშე) */
const qualifiedOrderMatch = (opts) => ({ $and: [businessOrderMatch(opts), { status: { $ne: 'cancelled' } }] });

// აგრეგაციის გამოსახულებები
const isCompletedExpr = { $eq: ['$status', COMPLETED] };
const isOpenExpr = { $in: ['$status', OPEN_STATUSES] };
const lineTotalExpr = { $multiply: ['$items.price', '$items.quantity'] };
const sumIf = (cond, value = 1) => ({ $sum: { $cond: [cond, value, 0] } });

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** პროცენტული ცვლილება; წინა = 0 → null (UI: „ახალი") */
const change = (current, previous) => (previous ? round2(((current - previous) / previous) * 100) : null);
const ratio = (a, b) => (b ? round2((a / b) * 100) : null);

/** ელ-ფოსტის ნიღაბი: luka@gmail.com → l***@gmail.com */
const maskEmail = (email) => {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '';
  return `${local[0]}***@${domain}`;
};

module.exports = {
  STAFF_ROLES,
  COMPLETED,
  OPEN_STATUSES,
  staffUserIds,
  dateMatch,
  businessOrderMatch,
  qualifiedOrderMatch,
  isCompletedExpr,
  isOpenExpr,
  lineTotalExpr,
  sumIf,
  round2,
  change,
  ratio,
  maskEmail,
};
