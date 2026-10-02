const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const httpError = require('../utils/httpError');
const { COMMENT_MIN, COMMENT_MAX } = Review;

/*
 * შეფასებები — ერთადერთი ადგილი, სადაც:
 *   • მოწმდება ნამდვილი შეძენა (verified purchase) — მხოლოდ შეკვეთების მონაცემებით, frontend-ს არ ენდობა;
 *   • ითვლება Product.rating / reviewCount — მხოლოდ published შეფასებებიდან (recalcProductRating).
 * ყველა მომხმარებლის ოპერაცია შემოიფარგლება req.user-ით (filter { _id, user }) — სხვისი id → 404.
 */

const { ObjectId } = mongoose.Types;
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  highest: { rating: -1, createdAt: -1, _id: -1 },
  lowest: { rating: 1, createdAt: -1, _id: -1 },
};
const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;
const ADMIN_PAGE_SIZE = 20;

const invalidProduct = () => httpError(400, 'არასწორი პროდუქტი', { code: 'INVALID_PRODUCT' });
const unavailable = () => httpError(404, 'პროდუქტი აღარ არის ხელმისაწვდომი', { code: 'PRODUCT_UNAVAILABLE', product: '' });
const reviewNotFound = () => httpError(404, 'შეფასება ვერ მოიძებნა', { code: 'REVIEW_NOT_FOUND' });

const toObjectId = (id, onInvalid = invalidProduct) => {
  if (!mongoose.isValidObjectId(id)) throw onInvalid();
  return new ObjectId(String(id));
};

/** rating — მთელი 1..5; comment — trim, COMMENT_MIN..COMMENT_MAX */
const validateInput = (body = {}) => {
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(400, 'შეფასება უნდა იყოს 1-დან 5-მდე', { code: 'INVALID_RATING' });
  }
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (comment.length < COMMENT_MIN) {
    throw httpError(400, `კომენტარი მინიმუმ ${COMMENT_MIN} სიმბოლო უნდა იყოს`, { code: 'COMMENT_TOO_SHORT', min: COMMENT_MIN });
  }
  if (comment.length > COMMENT_MAX) {
    throw httpError(400, `კომენტარი მაქსიმუმ ${COMMENT_MAX} სიმბოლოა`, { code: 'COMMENT_TOO_LONG', max: COMMENT_MAX });
  }
  return { rating, comment };
};

// ---------------------------------------------------------------- verified purchase

/** ბოლო დასრულებული შეკვეთა, რომელშიც ეს პროდუქტი (ნებისმიერი ვარიანტით) იყო; null — თუ არ უყიდია */
const findCompletedPurchase = async (userId, productId) => {
  const order = await Order.findOne({ user: userId, status: 'completed', 'items.product': productId })
    .sort({ createdAt: -1 })
    .select('items.product items.variant')
    .lean();
  if (!order) return null;
  const item = order.items.find((i) => String(i.product) === String(productId));
  const variant = item?.variant?.id ? { id: item.variant.id, sku: item.variant.sku || '' } : undefined;
  return { order: order._id, variant };
};

// ---------------------------------------------------------------- aggregates

const statsFor = async (productId) => {
  const [row] = await Review.aggregate([
    { $match: { product: productId, status: 'published' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return row ? { rating: Math.round(row.avg * 10) / 10, reviewCount: row.count } : { rating: 0, reviewCount: 0 };
};

/**
 * Product.rating / reviewCount თავიდან — published შეფასებებიდან (ნული შეფასება → 0 / 0).
 * ყოველი ცვლილების შემდეგ (create / update / delete / hide / restore) — ერთი და იგივე ფუნქცია.
 * პარალელური ცვლილებებისთვის: ჩაწერის შემდეგ ხელახლა ითვლის, სანამ შედეგი არ დასტაბილურდება.
 */
const recalcProductRating = async (productId) => {
  const id = toObjectId(productId);
  let stats = await statsFor(id);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await Product.updateOne({ _id: id }, { $set: stats });
    const again = await statsFor(id);
    if (again.rating === stats.rating && again.reviewCount === stats.reviewCount) break;
    stats = again;
  }
  return stats;
};

/** საშუალო, რაოდენობა და განაწილება (1..5) — სერვერზე, ინდექსით; შეფასებები ბრაუზერში არ იტვირთება */
const summary = async (productId) => {
  const id = toObjectId(productId);
  const rows = await Review.aggregate([
    { $match: { product: id, status: 'published' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  rows.forEach((r) => {
    distribution[r._id] = r.count;
    count += r.count;
    sum += r._id * r.count;
  });
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution };
};

// ---------------------------------------------------------------- public shapes

/** საჯარო სახელი: „ლუკა კ." — ელ-ფოსტა/ტელეფონი/id/მისამართი არასდროს; წაშლილი/დეაქტივირებული → null (frontend: „მყიდველი") */
const publicAuthor = (user) => {
  if (!user || user.isActive === false) return null;
  const first = (user.firstName || '').trim();
  const initial = (user.lastName || '').trim().charAt(0);
  if (!first) return null;
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
};

const toPublic = (r) => ({
  _id: r._id,
  rating: r.rating,
  comment: r.comment,
  verifiedPurchase: !!r.verifiedPurchase,
  author: publicAuthor(r.user),
  createdAt: r.createdAt,
  editedAt: r.editedAt || null,
});

/** ავტორის საკუთარი შეფასება (სტატუსითაც — დამალულიც ჩანს მისთვის) */
const toOwn = (r) => r && {
  _id: r._id,
  product: r.product,
  rating: r.rating,
  comment: r.comment,
  verifiedPurchase: !!r.verifiedPurchase,
  status: r.status,
  createdAt: r.createdAt,
  editedAt: r.editedAt || null,
};

// ---------------------------------------------------------------- public list

const list = async (productId, { sort, page, limit, rating } = {}) => {
  const id = toObjectId(productId);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || PAGE_SIZE));
  const filter = { product: id, status: 'published' };
  const star = Number(rating);
  if (Number.isInteger(star) && star >= 1 && star <= 5) filter.rating = star;

  const [rows, total] = await Promise.all([
    Review.find(filter)
      .sort(SORTS[sort] || SORTS.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('rating comment verifiedPurchase user createdAt editedAt')
      .populate('user', 'firstName lastName isActive')
      .lean(),
    Review.countDocuments(filter),
  ]);
  return { reviews: rows.map(toPublic), page: pageNum, pages: Math.ceil(total / limitNum), total };
};

// ---------------------------------------------------------------- current user

/** შეუძლია თუ არა შეფასება: { canReview, reason, review } */
const eligibility = async (userId, productId) => {
  const id = toObjectId(productId);
  const product = await Product.findOne({ _id: id, isActive: true }).select('_id').lean();
  if (!product) throw unavailable();
  const own = await Review.findOne({ user: userId, product: id }).lean();
  if (own) return { canReview: false, reason: own.status === 'hidden' ? 'REVIEW_HIDDEN' : 'ALREADY_REVIEWED', review: toOwn(own) };
  const purchase = await findCompletedPurchase(userId, id);
  return { canReview: !!purchase, reason: purchase ? null : 'NOT_PURCHASED', review: null };
};

/** მრავალი პროდუქტი ერთი მოთხოვნით (My Orders): { [productId]: ownReview | null } */
const myStatus = async (userId, productIds = []) => {
  const ids = [...new Set(productIds.map(String))].filter((id) => mongoose.isValidObjectId(id)).slice(0, 100);
  if (!ids.length) return {};
  const [reviews, products] = await Promise.all([
    Review.find({ user: userId, product: { $in: ids } }).lean(),
    Product.find({ _id: { $in: ids }, isActive: true }).select('_id').lean(),
  ]);
  const byProduct = new Map(reviews.map((r) => [String(r.product), r]));
  const available = new Set(products.map((p) => String(p._id)));
  // მიუწვდომელი პროდუქტი (წაშლილი/არააქტიური) — სიაში არ ბრუნდება → ღილაკი არ ჩანს
  return Object.fromEntries(ids.filter((id) => available.has(id)).map((id) => [id, toOwn(byProduct.get(id)) || null]));
};

const create = async (userId, productId, body) => {
  const id = toObjectId(productId);
  const input = validateInput(body);
  const product = await Product.findOne({ _id: id, isActive: true }).select('_id').lean();
  if (!product) throw unavailable();
  if (await Review.exists({ user: userId, product: id })) {
    throw httpError(409, 'ამ პროდუქტს უკვე შეაფასეთ', { code: 'ALREADY_REVIEWED' });
  }
  const purchase = await findCompletedPurchase(userId, id);
  if (!purchase) {
    throw httpError(403, 'შეფასება შესაძლებელია მხოლოდ შეძენილ (დასრულებულ შეკვეთაში) პროდუქტზე', { code: 'NOT_PURCHASED' });
  }
  let review;
  try {
    review = await Review.create({ user: userId, product: id, ...input, verifiedPurchase: true, ...purchase, status: 'published' });
  } catch (err) {
    // პარალელური ორი მოთხოვნა — unique index-მა მეორე შეაჩერა
    if (err.code === 11000) throw httpError(409, 'ამ პროდუქტს უკვე შეაფასეთ', { code: 'ALREADY_REVIEWED' });
    throw err;
  }
  await recalcProductRating(id);
  return toOwn(review.toObject());
};

const update = async (userId, reviewId, body) => {
  const id = toObjectId(reviewId, reviewNotFound);
  const input = validateInput(body);
  // მხოლოდ საკუთარი; სტატუსი (დამალული) უცვლელი რჩება
  const review = await Review.findOneAndUpdate(
    { _id: id, user: userId },
    { $set: { ...input, editedAt: new Date() } },
    { new: true, runValidators: true }
  ).lean();
  if (!review) throw reviewNotFound();
  await recalcProductRating(review.product);
  return toOwn(review);
};

const remove = async (userId, reviewId) => {
  const id = toObjectId(reviewId, reviewNotFound);
  const review = await Review.findOneAndDelete({ _id: id, user: userId }).lean();
  if (!review) throw reviewNotFound();
  await recalcProductRating(review.product);
  return { _id: review._id, product: review.product };
};

/** შეკვეთის ის პროდუქტები, რომლებიც ჯერ შეფასებული არ აქვს და ჯერ კიდევ ხელმისაწვდომია (review_reminder) */
const unreviewedProducts = async (userId, productIds = []) => {
  const ids = [...new Set(productIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return [];
  const [reviewed, available] = await Promise.all([
    Review.find({ user: userId, product: { $in: ids } }).distinct('product'),
    Product.find({ _id: { $in: ids }, isActive: true }).distinct('_id'),
  ]);
  const done = new Set(reviewed.map(String));
  const ok = new Set(available.map(String));
  return ids.filter((id) => ok.has(id) && !done.has(id));
};

// ---------------------------------------------------------------- admin / manager

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const adminList = async ({ status, rating, search, page } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const filter = {};
  if (['published', 'hidden'].includes(status)) filter.status = status;
  const star = Number(rating);
  if (Number.isInteger(star) && star >= 1 && star <= 5) filter.rating = star;

  const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const [products, users] = await Promise.all([
      Product.find({ $or: [{ name: rx }, { slug: rx }, { 'translations.en.name': rx }, { 'translations.ru.name': rx }] })
        .select('_id')
        .limit(200)
        .lean(),
      User.find({ $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] }).select('_id').limit(200).lean(),
    ]);
    filter.$or = [
      { product: { $in: products.map((p) => p._id) } },
      { user: { $in: users.map((u) => u._id) } },
      { comment: rx },
    ];
  }

  const [rows, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNum - 1) * ADMIN_PAGE_SIZE)
      .limit(ADMIN_PAGE_SIZE)
      .populate('user', 'firstName lastName email isActive')
      .populate('product', 'name slug image images')
      .populate('moderatedBy', 'firstName lastName')
      .lean(),
    Review.countDocuments(filter),
  ]);
  const reviews = rows.map((r) => ({
    _id: r._id,
    rating: r.rating,
    comment: r.comment,
    status: r.status,
    verifiedPurchase: !!r.verifiedPurchase,
    createdAt: r.createdAt,
    editedAt: r.editedAt || null,
    moderatedAt: r.moderatedAt || null,
    moderatedBy: r.moderatedBy ? `${r.moderatedBy.firstName || ''} ${r.moderatedBy.lastName || ''}`.trim() : null,
    // პერსონალი ხედავს ელ-ფოსტას (მოდერაციისთვის); საჯარო API-ში — არასდროს
    user: r.user ? { _id: r.user._id, name: `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim(), email: r.user.email, isActive: r.user.isActive !== false } : null,
    product: r.product ? { _id: r.product._id, name: r.product.name, slug: r.product.slug, image: r.product.image || r.product.images?.[0] || '' } : null,
  }));
  return { reviews, page: pageNum, pages: Math.ceil(total / ADMIN_PAGE_SIZE), total };
};

/** დამალვა / აღდგენა — შეფასება არ იშლება; აგრეგატი თავიდან ითვლება. განმეორებითი — უსაფრთხოა. */
const setStatus = async (reviewId, status, moderatorId) => {
  const id = toObjectId(reviewId, reviewNotFound);
  const review = await Review.findOneAndUpdate(
    { _id: id },
    { $set: { status, moderatedBy: moderatorId, moderatedAt: new Date() } },
    { new: true }
  ).lean();
  if (!review) throw reviewNotFound();
  await recalcProductRating(review.product);
  return { _id: review._id, status: review.status, product: review.product };
};

/** პროდუქტის წაშლისას — მისი შეფასებებიც (ობოლი ჩანაწერები არ რჩება) */
const deleteForProduct = (productId) => Review.deleteMany({ product: productId });

module.exports = {
  validateInput,
  findCompletedPurchase,
  recalcProductRating,
  summary,
  list,
  eligibility,
  myStatus,
  create,
  update,
  remove,
  unreviewedProducts,
  adminList,
  setStatus,
  deleteForProduct,
  publicAuthor,
};
