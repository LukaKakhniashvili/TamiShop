const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, default: null },
    onSale: { type: Boolean, default: false },
    specifications: {
      type: [{ key: String, value: String }],
      default: []
    },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    inStock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    // პოპულარობის სიგნალები (გამოიყენება ბესტსელერებისა და რეკომენდაციებისთვის)
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
