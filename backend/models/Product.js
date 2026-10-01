const mongoose = require('mongoose');

/*
 * პროდუქტი → ოფციები (options) → ოფციის მნიშვნელობები (values) → დასაშვები ვარიანტები (variants).
 *
 *   specifications — მხოლოდ საინფორმაციო მახასიათებლები (ეკრანი, პროცესორი...) — მომხმარებელი არ ირჩევს.
 *   options        — მომხმარებლის მიერ ასარჩევი პარამეტრები (ფერი, მეხსიერება, ზომა...) — ნებისმიერი სახელით,
 *                    სქემის ცვლილების გარეშე. მნიშვნელობებს აქვს მუდმივი _id (სახელის შეცვლა ვარიანტებს არ არღვევს).
 *   variants       — მნიშვნელობების დასაშვები კომბინაციები საკუთარი ფასით, მარაგით, SKU-თ და სტატუსით.
 *                    ყველა მათემატიკურად შესაძლო კომბინაცია არ არის აუცილებელი.
 *
 * მარტივ პროდუქტს (options/variants ცარიელია) ყველაფერი ისე აქვს, როგორც ადრე.
 * ვარიანტიან პროდუქტზე price / oldPrice / inStock ავტომატურად ითვლება ვარიანტებიდან (pre-save) —
 * ბარათები, სორტირება, „ცხელი შეთავაზებები" და ფასდაკლების ფილტრები უცვლელად მუშაობს.
 */

const optionValueSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  // არასავალდებულო ფერის ნიმუში (#RRGGBB) — მხოლოდ ვიზუალისთვის; სახელი ყოველთვის ჩანს
  color: { type: String, default: null },
  // არასავალდებულო თარგმანები { en: { label }, ru: { label } } — utils/translations.js; fallback — ქართული
  translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
});

const optionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // აუცილებელია თუ არა არჩევა კალათაში დამატებამდე
  required: { type: Boolean, default: true },
  // 'swatch' — ფერის ნიმუშებით, 'chip' — ტექსტური ღილაკები
  display: { type: String, enum: ['chip', 'swatch'], default: 'chip' },
  values: { type: [optionValueSchema], default: [] },
  // არასავალდებულო თარგმანები { en: { name }, ru: { name } } — utils/translations.js; fallback — ქართული
  translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
});

const variantSchema = new mongoose.Schema({
  // ოფციის მნიშვნელობების _id-ები — მაქსიმუმ ერთი თითო ოფციაზე (არასავალდებულო ოფცია შეიძლება აკლდეს)
  values: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  price: { type: Number, required: true, min: 0 },
  // თავდაპირველი ფასი (ფასდაკლება ჩანს, როცა პროდუქტი onSale-ია და oldPrice > price)
  oldPrice: { type: Number, default: null },
  stock: { type: Number, default: 0, min: 0 },
  sku: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
});

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
    // { en: { name, description, specifications: [{ key, value }] }, ru: {...} } — specifications ინდექსით
    translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
    options: { type: [optionSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
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

const isPurchasable = (v) => v.isActive !== false && v.stock > 0;

/**
 * ვარიანტიანი პროდუქტის შემაჯამებელი ველები: „ფასი -დან" = ყველაზე იაფი ხელმისაწვდომი ვარიანტი
 * (თუ ასეთი არ არის — ყველაზე იაფი აქტიური), inStock = არსებობს ხელმისაწვდომი ვარიანტი.
 */
productSchema.methods.syncVariantSummary = function () {
  if (!this.variants?.length) return;
  const active = this.variants.filter((v) => v.isActive !== false);
  const purchasable = active.filter(isPurchasable);
  const pool = purchasable.length ? purchasable : active.length ? active : this.variants;
  const base = pool.reduce((min, v) => (v.price < min.price ? v : min), pool[0]);
  this.price = base.price;
  this.oldPrice = base.oldPrice && base.oldPrice > base.price ? base.oldPrice : null;
  this.inStock = purchasable.length > 0;
};

productSchema.pre('save', function (next) {
  this.syncVariantSummary();
  next();
});

module.exports = mongoose.model('Product', productSchema);
