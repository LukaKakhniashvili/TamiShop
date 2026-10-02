const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const httpError = require('../utils/httpError');
const { withComputedFields } = require('./productStats');

/*
 * Wishlist / რჩეულები — User.wishlist: [{ product, addedAt }] (მხოლოდ მითითებები, პროდუქტის ასლი არა).
 * პროდუქტი ყოველთვის მიმდინარე მონაცემებით ჩანს (ფასი, მარაგი, თარგმანები, სურათები).
 *   წაშლილი პროდუქტი — სიიდან ავტომატურად იშლება; არააქტიური — იმალება, მაგრამ რჩება (შეიძლება დაბრუნდეს).
 * ყველა ოპერაცია — მხოლოდ req.user-ის სიაზე; დუბლიკატი ატომურად გამორიცხულია.
 * (მომავალში: „რჩეული პროდუქტი ფასდაკლებაზეა / მარაგშია" — Notification Center-ით, wishlist.product-ის ინდექსით.)
 */

const MAX_ITEMS = 200;

const notFound = () => httpError(404, 'პროდუქტი აღარ არის ხელმისაწვდომი', { code: 'PRODUCT_UNAVAILABLE', product: '' });

const getEntries = async (userId) => (await User.findById(userId).select('wishlist').lean())?.wishlist || [];

/** აქტიური პროდუქტების id-ები (უახლესი დამატებული პირველი); წაშლილები სიიდან იშლება */
const validIds = async (userId) => {
  const entries = await getEntries(userId);
  if (!entries.length) return { entries, products: [] };
  const ids = entries.map((e) => e.product);
  const products = await Product.find({ _id: { $in: ids } }).select('_id isActive').lean();
  const existing = new Set(products.map((p) => String(p._id)));
  const deleted = ids.filter((id) => !existing.has(String(id)));
  if (deleted.length) await User.updateOne({ _id: userId }, { $pull: { wishlist: { product: { $in: deleted } } } });
  const active = new Set(products.filter((p) => p.isActive).map((p) => String(p._id)));
  return { entries: entries.filter((e) => active.has(String(e.product))), products };
};

const sortNewest = (entries) => [...entries].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

const listIds = async (userId) => {
  const { entries } = await validIds(userId);
  return sortNewest(entries).map((e) => String(e.product));
};

/** სრული სია ProductCard-ისთვის — იგივე ველები, რაც კატალოგში (withComputedFields: isNew, ფასდაკლება...) */
const listProducts = async (userId) => {
  const { entries } = await validIds(userId);
  const order = sortNewest(entries).map((e) => String(e.product));
  if (!order.length) return [];
  const products = await Product.find({ _id: { $in: order }, isActive: true }).populate('category', 'name slug translations').lean();
  const byId = new Map(products.map((p) => [String(p._id), withComputedFields(p)]));
  return order.map((id) => byId.get(id)).filter(Boolean);
};

const add = async (userId, productId) => {
  if (!mongoose.isValidObjectId(productId)) throw notFound();
  const product = await Product.findOne({ _id: productId, isActive: true }).select('_id').lean();
  if (!product) throw notFound();
  // ატომური: დამატება მხოლოდ თუ ჯერ არ არის და ლიმიტი არ არის ამოწურული
  const r = await User.updateOne(
    { _id: userId, 'wishlist.product': { $ne: product._id }, [`wishlist.${MAX_ITEMS - 1}`]: { $exists: false } },
    { $push: { wishlist: { product: product._id, addedAt: new Date() } } }
  );
  if (!r.modifiedCount) {
    const already = await User.exists({ _id: userId, 'wishlist.product': product._id });
    if (!already) throw httpError(409, `რჩეულებში მაქსიმუმ ${MAX_ITEMS} პროდუქტია`, { code: 'WISHLIST_FULL', max: MAX_ITEMS });
  }
  return listIds(userId);
};

const remove = async (userId, productId) => {
  if (!mongoose.isValidObjectId(productId)) throw httpError(400, 'არასწორი პროდუქტი', { code: 'INVALID_PRODUCT' });
  await User.updateOne({ _id: userId }, { $pull: { wishlist: { product: new mongoose.Types.ObjectId(String(productId)) } } });
  return listIds(userId);
};

module.exports = { listIds, listProducts, add, remove, MAX_ITEMS };
