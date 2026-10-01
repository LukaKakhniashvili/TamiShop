const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { normalizeTranslations, CATEGORY_TRANSLATION_FIELDS } = require('../utils/translations');

const slugify = (str) => {
  const slug = str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || `category-${Date.now().toString(36)}`;
};

// @desc    ყველა კატეგორიის მიღება (სორტირება order ველის მიხედვით)
//          ?withStats=true — თითოეულს ემატება productCount და previewImage (ყველაზე პოპულარული პროდუქტის სურათი)
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort('order name').lean();
  if (req.query.withStats !== 'true') return res.json(categories);

  const stats = await Product.aggregate([
    { $match: { isActive: true } },
    { $sort: { reviewCount: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$category',
        productCount: { $sum: 1 },
        previewImage: { $first: { $ifNull: ['$image', { $arrayElemAt: ['$images', 0] }] } },
      },
    },
  ]);
  const byId = new Map(stats.map((s) => [String(s._id), s]));
  res.json(
    categories.map((c) => ({
      ...c,
      productCount: byId.get(String(c._id))?.productCount || 0,
      previewImage: byId.get(String(c._id))?.previewImage || '',
    }))
  );
});

// @desc    ერთი კატეგორიის მიღება
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = asyncHandler(async (req, res) => {
  let query = {};
  if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    query = { _id: req.params.id };
  } else {
    query = { slug: req.params.id };
  }
  const category = await Category.findOne(query);
  if (!category) {
    res.status(404);
    throw new Error('კატეგორია ვერ მოიძებნა');
  }
  res.json(category);
});

// @desc    კატეგორიის შექმნა
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('კატეგორიის სახელი სავალდებულოა');
  }

  // Find max order
  const maxOrderCat = await Category.findOne({}).sort('-order');
  const nextOrder = maxOrderCat ? (maxOrderCat.order || 0) + 1 : 0;

  const category = await Category.create({
    name,
    description,
    translations: normalizeTranslations(req.body.translations, CATEGORY_TRANSLATION_FIELDS),
    slug: slugify(name),
    order: nextOrder
  });

  res.status(201).json(category);
});

// @desc    კატეგორიის განახლება
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error('კატეგორია ვერ მოიძებნა');
  }

  const { name, description, isActive } = req.body;
  if (name !== undefined) {
    category.name = name;
    category.slug = slugify(name);
  }
  if (description !== undefined) category.description = description;
  if (isActive !== undefined) category.isActive = isActive;
  if (req.body.translations !== undefined) {
    category.translations = normalizeTranslations(req.body.translations, CATEGORY_TRANSLATION_FIELDS);
    category.markModified('translations');
  }

  const updated = await category.save();
  res.json(updated);
});

// @desc    კატეგორიების სორტირება (Drag & Drop-ის შემდეგ)
// @route   PUT /api/categories/reorder
// @access  Private/Admin
const reorderCategories = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    res.status(400);
    throw new Error('კატეგორიების ID-ები არასწორია');
  }

  const promises = ids.map((id, index) => 
    Category.findByIdAndUpdate(id, { order: index })
  );
  await Promise.all(promises);

  res.json({ message: 'კატეგორიების თანმიმდევრობა განახლდა' });
});

// @desc    კატეგორიის წაშლა
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error('კატეგორია ვერ მოიძებნა');
  }
  await category.deleteOne();
  res.json({ message: 'კატეგორია წაიშალა' });
});

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
};
