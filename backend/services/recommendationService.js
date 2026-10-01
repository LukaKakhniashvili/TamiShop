const mongoose = require('mongoose');
const Product = require('../models/Product');
const { discountPercent, getSalesCounts, withComputedFields } = require('./productStats');

const CATEGORY_FIELDS = 'name slug';

/*
 * სიგნალების წონები. ალგორითმის გასაუმჯობესებლად საკმარისია აქ წონების შეცვლა
 * ან scoreProduct-ში ახალი სიგნალის დამატება (მაგ. wishlist, ქულები ნახვების ხანგრძლივობით).
 */
const WEIGHTS = {
  // კატეგორიისადმი ინტერესი სიგნალის წყაროს მიხედვით
  purchase: 3,
  cart: 2,
  view: 1,
  // პროდუქტის ქულის კომპონენტები
  affinity: 3,
  sales: 1.5,
  reviews: 1,
  rating: 0.8,
  discount: 0.5,
  alreadyViewedPenalty: 0.6,
};

const MAX_SIGNAL_IDS = 20;

const toObjectIds = (ids = []) =>
  ids.filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_SIGNAL_IDS).map((id) => new mongoose.Types.ObjectId(id));

// პოპულარობის ქულა 0..1: გაყიდვები, შეფასებების რაოდენობა (ლოგარითმულად) და საშუალო რეიტინგი
const popularityParts = (p, sales, maxSales, maxReviewsLog) => ({
  sales: maxSales ? (sales.get(String(p._id)) || 0) / maxSales : 0,
  reviews: maxReviewsLog ? Math.log1p(p.reviewCount || 0) / maxReviewsLog : 0,
  rating: (p.rating || 0) / 5,
});

/**
 * ბესტსელერები: ჯერ რეალური გაყიდვები შეკვეთებიდან, შემდეგ (თუ გაყიდვები ცოტაა)
 * ივსება პოპულარობით — შეფასებების რაოდენობა და რეიტინგი.
 */
const getBestSellers = async (limit = 10) => {
  const sales = await getSalesCounts();
  const soldIds = [...sales.keys()];

  const sold = await Product.find({ _id: { $in: soldIds }, isActive: true })
    .populate('category', CATEGORY_FIELDS)
    .lean();
  sold.sort((a, b) => sales.get(String(b._id)) - sales.get(String(a._id)) || (b.reviewCount || 0) - (a.reviewCount || 0));

  let result = sold.slice(0, limit);
  if (result.length < limit) {
    const fill = await Product.find({ isActive: true, inStock: true, _id: { $nin: soldIds } })
      .sort({ reviewCount: -1, rating: -1, createdAt: -1 })
      .limit(limit - result.length)
      .populate('category', CATEGORY_FIELDS)
      .lean();
    result = result.concat(fill);
  }

  return result.map((p) => ({ ...withComputedFields(p), soldCount: sales.get(String(p._id)) || 0 }));
};

/**
 * რეკომენდაციები.
 * სიგნალები: მომხმარებლის შეკვეთები (ავტორიზებულისთვის), კალათა და ბოლოს ნანახი პროდუქტები
 * (კლიენტი აგზავნის). სიგნალებიდან ვიღებთ კატეგორიებისადმი ინტერესს და ვაფასებთ კანდიდატებს:
 *   score = affinity + პოპულარობა (გაყიდვები, შეფასებები, რეიტინგი) + ფასდაკლება − უკვე ნანახის ჯარიმა
 * სიგნალების არარსებობისას (ანონიმური/ახალი მომხმარებელი) affinity = 0 და შედეგი
 * ეფუძნება პოპულარობასა და ფასდაკლებებს.
 *
 * @returns {Promise<{ strategy: 'personalized' | 'popular', products: object[] }>}
 */
const getRecommendations = async ({ userId, viewedIds = [], cartIds = [], limit = 10 }) => {
  const viewed = toObjectIds(viewedIds);
  const cart = toObjectIds(cartIds);

  const purchasedSales = userId ? await getSalesCounts({ user: new mongoose.Types.ObjectId(userId) }) : new Map();
  const purchased = [...purchasedSales.keys()].map((id) => new mongoose.Types.ObjectId(id));

  // კატეგორიებისადმი ინტერესი
  const signalProducts = await Product.find({ _id: { $in: [...purchased, ...cart, ...viewed] } })
    .select('category')
    .lean();
  const categoryOf = new Map(signalProducts.map((p) => [String(p._id), String(p.category)]));
  const affinity = new Map();
  const addAffinity = (ids, weight, decay = false) =>
    ids.forEach((id, index) => {
      const cat = categoryOf.get(String(id));
      if (!cat) return;
      // ნანახებზე: რაც უფრო ახლახან ნანახია (მასივის დასაწყისი), მით მეტი წონა
      const w = decay ? weight / (1 + index * 0.25) : weight;
      affinity.set(cat, (affinity.get(cat) || 0) + w);
    });
  addAffinity(purchased, WEIGHTS.purchase);
  addAffinity(cart, WEIGHTS.cart);
  addAffinity(viewed, WEIGHTS.view, true);

  const personalized = affinity.size > 0;
  const maxAffinity = Math.max(0, ...affinity.values());

  // კანდიდატები: პოპულარული პროდუქტები + ინტერესის კატეგორიების პროდუქტები.
  // უკვე ნაყიდი და კალათაში არსებული პროდუქტები გამოირიცხება.
  const exclude = [...purchased, ...cart];
  const base = { isActive: true, inStock: true, _id: { $nin: exclude } };
  const [popular, related] = await Promise.all([
    Product.find(base).sort({ reviewCount: -1, rating: -1 }).limit(150).populate('category', CATEGORY_FIELDS).lean(),
    personalized
      ? Product.find({ ...base, category: { $in: [...affinity.keys()] } }).limit(150).populate('category', CATEGORY_FIELDS).lean()
      : [],
  ]);
  const candidates = [...new Map([...popular, ...related].map((p) => [String(p._id), p])).values()];

  const sales = await getSalesCounts();
  const maxSales = Math.max(0, ...sales.values());
  const maxReviewsLog = Math.max(0, ...candidates.map((p) => Math.log1p(p.reviewCount || 0)));
  const viewedSet = new Set(viewed.map(String));

  const scored = candidates.map((p) => {
    const pop = popularityParts(p, sales, maxSales, maxReviewsLog);
    const catAffinity = maxAffinity ? (affinity.get(String(p.category?._id)) || 0) / maxAffinity : 0;
    const score =
      WEIGHTS.affinity * catAffinity +
      WEIGHTS.sales * pop.sales +
      WEIGHTS.reviews * pop.reviews +
      WEIGHTS.rating * pop.rating +
      WEIGHTS.discount * Math.min(discountPercent(p), 50) / 50 -
      (viewedSet.has(String(p._id)) ? WEIGHTS.alreadyViewedPenalty : 0);
    return { product: p, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // მრავალფეროვნება: ერთი კატეგორიიდან შეზღუდული რაოდენობა
  const perCategoryCap = personalized ? Math.ceil(limit / 2) : 2;
  const perCategory = new Map();
  const picked = [];
  const leftovers = [];
  for (const { product } of scored) {
    const cat = String(product.category?._id);
    if ((perCategory.get(cat) || 0) < perCategoryCap) {
      picked.push(product);
      perCategory.set(cat, (perCategory.get(cat) || 0) + 1);
    } else {
      leftovers.push(product);
    }
    if (picked.length >= limit) break;
  }
  // თუ კატეგორიები ცოტაა და ლიმიტი ვერ შეივსო, ვავსებთ დარჩენილებით
  const products = picked.concat(leftovers).slice(0, limit).map((p) => withComputedFields(p));

  return { strategy: personalized ? 'personalized' : 'popular', products };
};

module.exports = { getBestSellers, getRecommendations };
