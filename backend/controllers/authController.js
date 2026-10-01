const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendVerificationEmail } = require('../services/email/emailService');
const { normalizeEmail, isValidEmail, issueCode, codeStatus, checkCode } = require('../services/verificationCodes');
const { validatePassword } = require('../utils/passwordPolicy');
const httpError = require('../utils/httpError');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const publicUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  address: user.address,
  role: user.role,
  avatar: user.avatar,
});

// @desc    Google-ით ავტორიზაცია (frontend გვაწვდის Google ID token-ს)
// @route   POST /api/auth-google-login
// @access  Public
const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400);
    throw new Error('Google credential არ არის მოწოდებული');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const { sub: googleId, email, given_name, family_name, picture } = payload;

  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    user = await User.create({
      googleId,
      email,
      firstName: given_name || 'მომხმარებელი',
      lastName: family_name || '',
      avatar: picture || '',
    });
  } else if (!user.googleId) {
    user.googleId = googleId;
    if (!user.avatar) user.avatar = picture || '';
    await user.save();
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('თქვენი ანგარიში დეაქტივირებულია');
  }

  res.json({ token: generateToken(user._id), user: publicUser(user) });
});

// @desc    რეგისტრაცია (ელ. ფოსტით, პაროლით და ვერიფიკაციის კოდით)
// @route   POST /api/auth-register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, email, password, city, street, code } = req.body;

  if (!firstName || !email || !password || !code) {
    res.status(400);
    throw new Error('ყველა სავალდებულო ველი უნდა იყოს შევსებული');
  }

  const passwordError = validatePassword(password);
  if (passwordError) throw httpError(400, passwordError, { code: 'WEAK_PASSWORD' });

  // ელ. ფოსტა დადასტურებული უნდა იყოს (verify-ით) იმავე კოდით და ბოლო 30 წუთში
  const otpRecord = await Otp.findOne({ email: email.toLowerCase() });
  const verifiedRecently =
    otpRecord?.codeHash &&
    otpRecord.verifiedAt &&
    Date.now() - otpRecord.verifiedAt.getTime() < Otp.OTP_VERIFIED_WINDOW_SECONDS * 1000 &&
    otpRecord.matches(String(code));
  if (!verifiedRecently) {
    throw httpError(400, 'ელ. ფოსტის ვერიფიკაციის ვადა ამოიწურა. გთხოვთ, დაადასტუროთ ელ. ფოსტა თავიდან.', {
      code: 'VERIFICATION_REQUIRED',
    });
  }

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    res.status(400);
    throw new Error('მომხმარებელი ამ ელ. ფოსტით უკვე არსებობს');
  }

  await otpRecord.deleteOne();

  const user = await User.create({
    firstName,
    lastName: lastName || '',
    phone: phone || '',
    email: email.toLowerCase(),
    password,
    address: {
      city: city || '',
      street: street || '',
      postalCode: '',
    },
  });

  res.status(201).json({ token: generateToken(user._id), user: publicUser(user) });
});

// @desc    ავტორიზაცია (ელ. ფოსტით და პაროლით)
// @route   POST /api/auth-login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('ელ. ფოსტა და პაროლი სავალდებულოა');
  }

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('ელ. ფოსტა ან პაროლი არასწორია');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('თქვენი ანგარიში დეაქტივირებულია');
  }

  res.json({ token: generateToken(user._id), user: publicUser(user) });
});

// ---------------------------------------------------------------------------
// რეგისტრაციის ვერიფიკაციის კოდი (purpose: EMAIL_VERIFICATION) — საერთო ლოგიკა: services/verificationCodes.js
// ---------------------------------------------------------------------------

// @desc    ვერიფიკაციის კოდის გაგზავნა / ხელახლა გაგზავნა
// @route   POST /api/auth-verification-code-send
// @access  Public
const sendOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isValidEmail(email)) throw httpError(400, 'შეიყვანეთ სწორი ელ. ფოსტა');

  if (await User.exists({ email })) throw httpError(400, 'მომხმარებელი ამ ელ. ფოსტით უკვე არსებობს');

  const timers = await issueCode(Otp, email, (code, expiresInMinutes) =>
    sendVerificationEmail({ to: email, code, expiresInMinutes })
  );
  res.json({ message: 'ვერიფიკაციის კოდი გაიგზავნა', ...timers });
});

// @desc    აქტიური კოდის ტაიმერები (გვერდის განახლების შემდეგ აღსადგენად). კოდს არ აბრუნებს.
// @route   GET /api/auth-verification-code-status?email=
// @access  Public
const otpStatus = asyncHandler(async (req, res) => {
  res.json(await codeStatus(Otp, normalizeEmail(req.query.email)));
});

// @desc    ვერიფიკაციის კოდის შემოწმება
// @route   POST /api/auth-verification-code-verify
// @access  Public
const verifyOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !code) throw httpError(400, 'ელ. ფოსტა და კოდი სავალდებულოა');

  const otp = await checkCode(Otp, email, code);

  // დადასტურებულია — რეგისტრაციის დასრულებას 30 წუთი აქვს (ფორმის შევსებას 3 წუთზე მეტი შეიძლება დასჭირდეს)
  const now = Date.now();
  otp.verifiedAt = new Date(now);
  otp.purgeAt = new Date(now + Otp.OTP_VERIFIED_WINDOW_SECONDS * 1000);
  await otp.save();

  res.json({ success: true, message: 'ელ. ფოსტა დადასტურდა' });
});

// @desc    მიმდინარე ავტორიზებული მომხმარებლის მონაცემები
// @route   GET /api/auth-profile
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// @desc    მომხმარებლის პროფილის განახლება
// @route   PUT /api/auth-profile-update
// @access  Private
const updateMe = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, address } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('მომხმარებელი ვერ მოიძებნა');
  }

  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = { ...user.address.toObject(), ...address };

  const updated = await user.save();
  res.json(updated);
});

module.exports = { googleLogin, register, login, sendOtp, otpStatus, verifyOtp, getMe, updateMe, generateToken };
