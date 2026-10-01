const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', protect, authorize('admin', 'manager'), createCategory);
router.put('/reorder', protect, authorize('admin', 'manager'), reorderCategories);
router.put('/:id', protect, authorize('admin', 'manager'), updateCategory);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteCategory);

module.exports = router;
