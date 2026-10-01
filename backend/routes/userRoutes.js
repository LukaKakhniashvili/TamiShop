const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, updateUserRole, updateUserStatus } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.get('/', protect, authorize('admin'), getUsers);
router.post('/', protect, authorize('admin'), createUser);
router.put('/:id', protect, authorize('admin'), updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);
router.put('/:id/role', protect, authorize('admin'), updateUserRole);
router.put('/:id/status', protect, authorize('admin'), updateUserStatus);

module.exports = router;
