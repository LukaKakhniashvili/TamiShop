const mongoose = require('mongoose');

/*
 * Review / შეფასება — ერთი მომხმარებელი + ერთი პროდუქტი = ერთი შეფასება (unique index).
 * მომხმარებლის/პროდუქტის მონაცემები არ კოპირდება — მხოლოდ მითითებები.
 * verifiedPurchase / order / variant — მხოლოდ სერვერი ადგენს (services/reviews.js), frontend-ს არ ენდობა.
 * Product.rating / reviewCount — მხოლოდ published შეფასებებიდან (recalcProductRating).
 * მომავალში (helpful ხმები, სურათები, მაღაზიის პასუხი, რეპორტი) — ახალი ველები, სქემის შეცვლის გარეშე.
 */

const REVIEW_STATUSES = ['published', 'hidden'];
const COMMENT_MIN = 3;
const COMMENT_MAX = 2000;

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'შეფასება უნდა იყოს მთელი რიცხვი 1-დან 5-მდე' },
    },
    comment: { type: String, required: true, trim: true, minlength: COMMENT_MIN, maxlength: COMMENT_MAX },
    verifiedPurchase: { type: Boolean, default: true },
    // დასრულებული შეკვეთა, რომელმაც შეფასების უფლება მისცა (შიდა — საჯაროდ არ ჩანს; ანალიტიკისთვის)
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    variant: {
      type: new mongoose.Schema({ id: mongoose.Schema.Types.ObjectId, sku: String }, { _id: false }),
      default: undefined,
    },
    // ავტორის ბოლო რედაქტირება (updatedAt მოდერაციითაც იცვლება)
    editedAt: { type: Date },
    status: { type: String, enum: REVIEW_STATUSES, default: 'published' },
    // მოდერაციის აუდიტი
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
  },
  { timestamps: true }
);

// ერთი შეფასება მომხმარებელზე/პროდუქტზე — პარალელური მოთხოვნებისთვისაც (+ „ჩემი შეფასება")
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
// საჯარო სია: უახლესი
reviewSchema.index({ product: 1, status: 1, createdAt: -1, _id: -1 });
// საჯარო სია: მაღალი/დაბალი შეფასება + საშუალო/განაწილების აგრეგაცია
reviewSchema.index({ product: 1, status: 1, rating: -1, createdAt: -1 });
// მოდერაციის სია + შეფასებები დროში (ანალიტიკა)
reviewSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
module.exports.REVIEW_STATUSES = REVIEW_STATUSES;
module.exports.COMMENT_MIN = COMMENT_MIN;
module.exports.COMMENT_MAX = COMMENT_MAX;
