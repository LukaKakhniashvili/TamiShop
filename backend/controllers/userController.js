const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// @desc    ყველა მომხმარებელი
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).sort('-createdAt');
  res.json(users);
});

// @desc    მომხმარებლის შექმნა (მხოლოდ admin/manager როლით ხელით დამატება)
// @route   POST /api/users
// @access  Private/Admin
const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;

  if (!firstName || !email || !password || !role) {
    res.status(400);
    throw new Error('სახელი, ელ. ფოსტა, პაროლი და როლი სავალდებულოა');
  }

  if (!['admin', 'manager'].includes(role)) {
    res.status(400);
    throw new Error('ამ გზით მხოლოდ ადმინისტრატორის ან მენეჯერის დამატებაა შესაძლებელი');
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    res.status(400);
    throw new Error('მომხმარებელი ამ ელ. ფოსტით უკვე არსებობს');
  }

  const user = await User.create({
    firstName,
    lastName: lastName || '',
    email: email.toLowerCase(),
    password,
    role,
  });

  res.status(201).json(user);
});

// @desc    მომხმარებლის განახლება
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, role, isActive, password } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('მომხმარებელი ვერ მოიძებნა');
  }

  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (email !== undefined) user.email = email.toLowerCase();
  
  if (role !== undefined) {
    if (!['admin', 'manager', 'customer'].includes(role)) {
      res.status(400);
      throw new Error('არასწორი როლი');
    }
    user.role = role;
  }
  
  if (isActive !== undefined) user.isActive = isActive;
  if (password) user.password = password;

  const updated = await user.save();
  res.json(updated);
});

// @desc    მომხმარებლის წაშლა
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('მომხმარებელი ვერ მოიძებნა');
  }

  await user.deleteOne();
  res.json({ message: 'მომხმარებელი წარმატებით წაიშალა' });
});

// @desc    მომხმარებლის როლის შეცვლა
// @route   PUT /api/users/:id/role
// @access  Private/Admin
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['customer', 'admin', 'manager'].includes(role)) {
    res.status(400);
    throw new Error('არასწორი როლი');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('მომხმარებელი ვერ მოიძებნა');
  }

  user.role = role;
  const updated = await user.save();
  res.json(updated);
});

// @desc    მომხმარებლის აქტივაცია/დეაქტივაცია
// @route   PUT /api/users/:id/status
// @access  Private/Admin
const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('მომხმარებელი ვერ მოიძებნა');
  }

  user.isActive = req.body.isActive;
  const updated = await user.save();
  res.json(updated);
});

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole,
  updateUserStatus,
};
