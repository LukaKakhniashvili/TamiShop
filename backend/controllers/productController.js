const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const {
  computedFieldsStage,
  discountPercentExpr,
  hasDiscountExpr,
  newSinceDate,
  withComputedFields,
} = require('../services/productStats');
const { getBestSellers, getRecommendations } = require('../services/recommendationService');
const { normalizeVariantConfig } = require('../services/productVariants');
const { normalizeTranslations, PRODUCT_TRANSLATION_FIELDS } = require('../utils/translations');
const { buildProductSearchFilter, localizedNameExpr, collationFor } = require('../utils/productSearch');
const { requestLanguage } = require('../utils/requestLanguage');
const Category = require('../models/Category');

const slugify = (str) => {
  const slug = str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || `product-${Date.now().toString(36)}`;
};

// სორტირების ვარიანტები (?sort=...). _id ბოლოს — სტაბილური თანმიმდევრობა გვერდებს შორის.
// ფასით სორტირება იყენებს `price`-ს — ეს უკვე საბოლოო (ფასდაკლებული) ფასია, oldPrice კი თავდაპირველი.
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  // სახელი — მოთხოვნის ენაზე (sortName, იხ. getProducts)
  name_asc: { sortName: 1, _id: 1 },
  name_desc: { sortName: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  discount_desc: { discountPercent: -1, price: 1, _id: 1 },
};

// @desc    პროდუქტების სია + სორტირება
//          ფილტრები: category, search, inStock, discounted=true (ნებისმიერი აქტიური ფასდაკლება),
//          minDiscount=N (ფასდაკლება >= N%), newOnly=true (ბოლო 14 დღეში დამატებული)
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const { category, search, inStock, admin, minDiscount, discounted, newOnly, sort, page = 1, limit = 9 } = req.query;
  const now = Date.now();

  const filter = {};

  if (admin !== 'true') {
    filter.isActive = true;
  }

  if (category) {
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      filter.category = new mongoose.Types.ObjectId(category);
    } else {
      const foundCat = await Category.findOne({ slug: category });
      if (foundCat) {
        filter.category = foundCat._id;
      } else {
        filter.category = new mongoose.Types.ObjectId('000000000000000000000000');
      }
    }
  }

  // ძიება სამივე ენაზე (სახელი, აღწერა, მახასიათებლები, კატეგორია) + ენებს შორის სინონიმები
  if (search) {
    const searchFilter = await buildProductSearchFilter(search, Category);
    if (searchFilter) Object.assign(filter, searchFilter);
  }

  if (inStock !== undefined && inStock !== '') {
    filter.inStock = inStock === 'true';
  }

  if (newOnly === 'true') {
    filter.createdAt = { $gte: newSinceDate(now) };
  }

  // გამოთვლილ ველებზე დაფუძნებული პირობები ($expr) — შეიძლება რამდენიმე ერთად
  const exprs = [];
  if (discounted === 'true') exprs.push(hasDiscountExpr);
  if (minDiscount !== undefined && minDiscount !== '' && !Number.isNaN(Number(minDiscount))) {
    exprs.push({ $gte: [discountPercentExpr, Number(minDiscount)] });
  }
  if (exprs.length) filter.$expr = exprs.length === 1 ? exprs[0] : { $and: exprs };

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 9));
  const skip = (pageNum - 1) * limitNum;

  // aggregate, რომ ფასდაკლების პროცენტით სორტირება შესაძლებელი იყოს;
  // სახელით სორტირება — არჩეული ენის სახელით (fallback ქართული), ენის collation-ით, რეგისტრის გარეშე
  const lng = requestLanguage(req);
  const [products, total] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      computedFieldsStage(now),
      { $addFields: { sortName: localizedNameExpr(lng) } },
      { $sort: SORTS[sort] || SORTS.newest },
      { $skip: skip },
      { $limit: limitNum },
      { $project: { sortName: 0 } },
    ]).collation(collationFor(lng)),
    Product.countDocuments(filter),
  ]);
  await Product.populate(products, { path: 'category', select: 'name slug translations' });

  res.json({
    products,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    total,
  });
});

const sectionLimit = (value, fallback = 10) => Math.min(24, Math.max(1, Number(value) || fallback));
const splitIds = (value) => (typeof value === 'string' && value ? value.split(',') : []);

// @desc    ბესტსელერები (რეალური გაყიდვები + პოპულარობა)
// @route   GET /api/products/best-sellers
// @access  Public
const getBestSellersHandler = asyncHandler(async (req, res) => {
  res.json(await getBestSellers(sectionLimit(req.query.limit)));
});

// @desc    რეკომენდებული პროდუქტები (?viewed=id1,id2&cart=id3 — კლიენტის აქტივობა; ტოკენის შემთხვევაში შეკვეთებიც)
// @route   GET /api/products/recommended
// @access  Public (ავტორიზაცია არასავალდებულოა)
const getRecommendedHandler = asyncHandler(async (req, res) => {
  res.json(
    await getRecommendations({
      userId: req.user?._id,
      viewedIds: splitIds(req.query.viewed),
      cartIds: splitIds(req.query.cart),
      limit: sectionLimit(req.query.limit),
    })
  );
});

// @desc    ერთი პროდუქტის მიღება
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  let query = {};
  if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    query = { _id: req.params.id };
  } else {
    query = { slug: req.params.id };
  }
  const product = await Product.findOne(query).populate('category', 'name slug translations');
  if (!product) {
    res.status(404);
    throw new Error('პროდუქტი ვერ მოიძებნა');
  }
  res.json(withComputedFields(product.toObject()));
});

// @desc    პროდუქტის შექმნა
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, oldPrice, onSale, specifications, image, images, category, inStock } = req.body;
  // ოფციები/ვარიანტები არასავალდებულოა; ვარიანტიან პროდუქტზე ფასი/მარაგი ვარიანტებიდან ითვლება
  const config = normalizeVariantConfig({ options: req.body.options, variants: req.body.variants });
  const hasVariants = config.variants.length > 0;

  if (!name || (!hasVariants && (price === undefined || price === '')) || !category) {
    res.status(400);
    throw new Error('სახელი, ფასი და კატეგორია სავალდებულოა');
  }

  const product = await Product.create({
    name,
    description,
    price: hasVariants ? 0 : price, // ვარიანტიანზე გადაიწერება pre-save-ში
    oldPrice: oldPrice !== undefined ? oldPrice : null,
    onSale: onSale !== undefined ? onSale : false,
    specifications: specifications || [],
    translations: normalizeTranslations(req.body.translations, PRODUCT_TRANSLATION_FIELDS),
    options: config.options,
    variants: config.variants,
    image,
    images: images || [],
    category,
    inStock: inStock !== undefined ? inStock : true,
    slug: `${slugify(name)}-${Date.now().toString(36)}`,
  });

  res.status(201).json(withComputedFields(product.toObject()));
});

// @desc    პროდუქტის განახლება
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('პროდუქტი ვერ მოიძებნა');
  }

  const { name, description, price, oldPrice, onSale, specifications, image, images, category, inStock, isActive } = req.body;
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (oldPrice !== undefined) product.oldPrice = oldPrice;
  if (onSale !== undefined) product.onSale = onSale;
  if (specifications !== undefined) product.specifications = specifications;
  if (image !== undefined) product.image = image;
  if (images !== undefined) product.images = images;
  if (category !== undefined) product.category = category;
  if (inStock !== undefined) product.inStock = inStock;
  if (isActive !== undefined) product.isActive = isActive;
  if (req.body.translations !== undefined) {
    product.translations = normalizeTranslations(req.body.translations, PRODUCT_TRANSLATION_FIELDS);
    product.markModified('translations');
  }

  // ოფციები/ვარიანტები — თუ რომელიმე გამოგზავნილია, ვალიდაცია სრულ კონფიგურაციაზე.
  // ისტორიული შეკვეთები არ ზიანდება: ისინი ინახავს საკუთარ snapshot-ს (სახელი, ოფციები, ფასი).
  if (req.body.options !== undefined || req.body.variants !== undefined) {
    const current = product.toObject();
    const config = normalizeVariantConfig({
      options: req.body.options !== undefined ? req.body.options : current.options,
      variants: req.body.variants !== undefined ? req.body.variants : current.variants,
    });
    product.options = config.options;
    product.variants = config.variants;
  }

  const updated = await product.save();
  res.json(withComputedFields(updated.toObject()));
});

// @desc    პროდუქტის წაშლა
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('პროდუქტი ვერ მოიძებნა');
  }
  await product.deleteOne();
  res.json({ message: 'პროდუქტი წაიშალა' });
});

module.exports = {
  getProducts,
  getBestSellersHandler,
  getRecommendedHandler,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
