const User = require('../../models/User');
const { nameTranslations } = require('../../utils/translations');
const { staffUserIds, round2 } = require('./base');

/*
 * რჩეულები — მხოლოდ მიმდინარე მდგომარეობა (User.wishlist). თარიღის ფილტრი არ გამოიყენება:
 * წაშლილი ჩანაწერები ისტორიას არ ტოვებს, ამიტომ „დამატებები დროში", კონვერსია და წაშლის წილი
 * ზუსტად ვერ დაითვლება და არ ითვლება (საჭიროებს მოვლენების აღრიცხვას — მომავალი ეტაპი).
 * წაშლილ პროდუქტზე მითითება არ ითვლება; არააქტიური პროდუქტი ჩანს ნიშნით.
 */

const TOP_LIMIT = 10;

const wishlist = async () => {
  const staffIds = await staffUserIds();
  const [facet] = await User.aggregate([
    { $match: { _id: { $nin: staffIds }, 'wishlist.0': { $exists: true } } },
    { $unwind: '$wishlist' },
    { $lookup: { from: 'products', localField: 'wishlist.product', foreignField: '_id', pipeline: [{ $project: { name: 1, translations: 1, slug: 1, image: 1, images: 1, isActive: 1, inStock: 1 } }], as: 'p' } },
    { $match: { 'p.0': { $exists: true } } },
    {
      $facet: {
        totals: [{ $group: { _id: null, entries: { $sum: 1 }, users: { $addToSet: '$_id' }, products: { $addToSet: '$wishlist.product' } } }],
        top: [
          { $group: { _id: '$wishlist.product', count: { $sum: 1 }, p: { $first: { $first: '$p' } } } },
          { $sort: { count: -1, _id: 1 } },
          { $limit: TOP_LIMIT },
        ],
      },
    },
  ]);
  const t = facet?.totals?.[0];
  const users = t?.users?.length || 0;
  return {
    currentState: true,
    entries: t?.entries || 0,
    users,
    products: t?.products?.length || 0,
    avgPerUser: users ? round2(t.entries / users) : null,
    top: (facet?.top || []).map((r) => ({
      productId: r._id,
      name: r.p.name,
      translations: nameTranslations(r.p),
      slug: r.p.slug,
      image: r.p.image || r.p.images?.[0] || '',
      isActive: r.p.isActive !== false,
      inStock: !!r.p.inStock,
      count: r.count,
    })),
  };
};

module.exports = { wishlist };
