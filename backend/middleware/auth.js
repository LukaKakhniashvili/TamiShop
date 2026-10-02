const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const httpError = require('../utils/httpError');

// იცავს route-ებს - მოითხოვს ვალიდურ JWT ტოკენს
const protect = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw httpError(401, 'არაავტორიზებული წვდომა - ტოკენი არ მოიძებნა', { code: 'UNAUTHORIZED' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-__v -wishlist +passwordChangedAt');

    // პაროლის შეცვლამდე/აღდგენამდე გაცემული ტოკენი აღარ მოქმედებს
    if (!user || !user.isActive || user.tokenIssuedBeforePasswordChange(decoded.iat)) {
      res.status(401);
      throw new Error('მომხმარებელი ვერ მოიძებნა ან დეაქტივირებულია');
    }

    req.user = user;
    next();
  } catch (error) {
    throw httpError(401, 'არაავტორიზებული წვდომა - ტოკენი არავალიდურია', { code: 'UNAUTHORIZED' });
  }
});

// არ მოითხოვს ტოკენს: თუ ვალიდური ტოკენი არსებობს, ავსებს req.user-ს, წინააღმდეგ შემთხვევაში აგრძელებს ანონიმურად
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-__v -wishlist +passwordChangedAt');
      if (user && user.isActive && !user.tokenIssuedBeforePasswordChange(decoded.iat)) req.user = user;
    } catch (error) {
      // არავალიდური ტოკენი — ვაგრძელებთ როგორც ანონიმური მომხმარებელი
    }
  }
  next();
});

module.exports = { protect, optionalAuth };
