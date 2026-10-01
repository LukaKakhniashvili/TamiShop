const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const PasswordResetCode = require('../models/PasswordResetCode');
const { sendPasswordResetEmail } = require('../services/email/emailService');
const { normalizeEmail, isValidEmail, issueCode, codeStatus, checkCode } = require('../services/verificationCodes');
const { validatePassword } = require('../utils/passwordPolicy');
const httpError = require('../utils/httpError');
const { requestLanguage } = require('../utils/requestLanguage');
const { generateToken } = require('./authController');

/*
 * პაროლის შეცვლა (ავტორიზებული) და აღდგენა (არაავტორიზებული).
 * პაროლები არასდროს ინახება ღია სახით (bcrypt — User მოდელის pre-save), არ ბრუნდება API-ში და არ ილოგება.
 */

const fieldError = (status, message, field, code) => httpError(status, message, { code, field });

// ---------------------------------------------------------------------------
// პაროლის შეცვლა — ავტორიზებული მომხმარებელი
// ---------------------------------------------------------------------------

// @desc    პაროლის შეცვლა (მიმდინარე პაროლის შემოწმებით)
// @route   POST /api/auth-password-change
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user.password) {
    // Google-ით შექმნილ ანგარიშს პაროლი არ აქვს — პაროლის დაყენება შესაძლებელია აღდგენით
    throw httpError(400, 'თქვენს ანგარიშს პაროლი არ აქვს (შესვლა Google-ით). პაროლის დასაყენებლად გამოიყენეთ ანგარიშის აღდგენა.', {
      code: 'NO_PASSWORD',
    });
  }

  if (!currentPassword) throw fieldError(400, 'შეიყვანეთ მიმდინარე პაროლი', 'currentPassword', 'CURRENT_PASSWORD_REQUIRED');
  if (!(await user.matchPassword(currentPassword))) {
    throw fieldError(400, 'მიმდინარე პაროლი არასწორია.', 'currentPassword', 'CURRENT_PASSWORD_INCORRECT');
  }

  const policyError = validatePassword(newPassword);
  if (policyError) throw fieldError(400, policyError, 'newPassword', 'WEAK_PASSWORD');

  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw fieldError(400, 'პაროლები არ ემთხვევა.', 'confirmPassword', 'PASSWORD_MISMATCH');
  }

  if (newPassword === currentPassword) {
    throw fieldError(400, 'ახალი პაროლი უნდა განსხვავდებოდეს მიმდინარე პაროლისგან.', 'newPassword', 'SAME_PASSWORD');
  }

  user.password = newPassword; // hash — pre-save; passwordChangedAt ძველ სესიებს აუქმებს
  await user.save();

  // ამ მოწყობილობაზე სესია გრძელდება ახალი ტოკენით; სხვა მოწყობილობებზე ძველი ტოკენები აღარ მოქმედებს
  res.json({ message: 'პაროლი წარმატებით შეიცვალა.', token: generateToken(user._id) });
});

// ---------------------------------------------------------------------------
// პაროლის აღდგენა (purpose: PASSWORD_RESET) — საერთო კოდის ლოგიკა: services/verificationCodes.js
// ---------------------------------------------------------------------------

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// @desc    აღდგენის კოდის გაგზავნა / ხელახლა გაგზავნა
// @route   POST /api/auth-password-reset-code-send
// @access  Public
const sendResetCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isValidEmail(email)) throw fieldError(400, 'შეიყვანეთ სწორი ელ. ფოსტა', 'email', 'INVALID_EMAIL');

  const user = await User.findOne({ email }).select('isActive').lean();
  if (!user) throw fieldError(404, 'ელ. ფოსტა ვერ მოიძებნა. გთხოვთ, დარეგისტრირდეთ.', 'email', 'EMAIL_NOT_FOUND');
  if (!user.isActive) throw fieldError(403, 'ეს ანგარიში დეაქტივირებულია.', 'email', 'ACCOUNT_DISABLED');

  const timers = await issueCode(PasswordResetCode, email, (code, expiresInMinutes) =>
    sendPasswordResetEmail({ to: email, code, expiresInMinutes, lng: requestLanguage(req) })
  );
  res.json({ message: 'აღდგენის კოდი გაიგზავნა', ...timers });
});

// @desc    აქტიური აღდგენის კოდის ტაიმერები (გვერდის განახლების შემდეგ). კოდს არ აბრუნებს.
// @route   GET /api/auth-password-reset-code-status?email=
// @access  Public
const resetCodeStatus = asyncHandler(async (req, res) => {
  res.json(await codeStatus(PasswordResetCode, normalizeEmail(req.query.email)));
});

// @desc    აღდგენის კოდის შემოწმება → მოკლევადიანი ერთჯერადი reset token
// @route   POST /api/auth-password-reset-code-verify
// @access  Public
const verifyResetCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !code) throw httpError(400, 'ელ. ფოსტა და კოდი სავალდებულოა', { code: 'REQUIRED_FIELDS' });

  const doc = await checkCode(PasswordResetCode, email, code);

  // კოდი გამოყენებულია (verifiedAt) — მეორედ ვეღარ გამოდგება. პაროლის შეცვლა მხოლოდ token-ით.
  const resetToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + PasswordResetCode.RESET_TOKEN_TTL_SECONDS * 1000);
  doc.verifiedAt = new Date();
  doc.resetTokenHash = hashToken(resetToken);
  doc.resetTokenExpiresAt = expiresAt;
  doc.purgeAt = expiresAt;
  await doc.save();

  res.json({ success: true, resetToken, expiresInSeconds: PasswordResetCode.RESET_TOKEN_TTL_SECONDS });
});

// @desc    ახალი პაროლის დაყენება reset token-ით
// @route   POST /api/auth-password-reset
// @access  Public (reset token)
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;
  if (!resetToken) throw httpError(400, 'აღდგენის სესია არავალიდურია. გთხოვთ, დაიწყოთ თავიდან.', { code: 'RESET_TOKEN_INVALID' });

  // ჯერ ვალიდაცია — token-ი არ იხარჯება არავალიდურ პაროლზე
  const policyError = validatePassword(newPassword);
  if (policyError) throw fieldError(400, policyError, 'newPassword', 'WEAK_PASSWORD');
  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw fieldError(400, 'პაროლები არ ემთხვევა.', 'confirmPassword', 'PASSWORD_MISMATCH');
  }

  // ატომურად ვხარჯავთ token-ს (ერთჯერადი): ერთი და იგივე token-ით მეორე მოთხოვნა ვეღარ გაივლის
  const session = await PasswordResetCode.findOneAndDelete({
    resetTokenHash: hashToken(resetToken),
    resetTokenExpiresAt: { $gt: new Date() },
  }).lean();
  if (!session) {
    throw httpError(400, 'აღდგენის სესიის ვადა ამოიწურა ან უკვე გამოყენებულია. გთხოვთ, დაიწყოთ თავიდან.', {
      code: 'RESET_TOKEN_INVALID',
    });
  }

  // ანგარიში განისაზღვრება მხოლოდ დადასტურებული სესიით — არა ფრონტენდიდან მოსული ელ. ფოსტით/ID-ით
  const user = await User.findOne({ email: session.email }).select('+password');
  if (!user || !user.isActive) throw httpError(400, 'ანგარიში ვერ მოიძებნა ან დეაქტივირებულია.', { code: 'ACCOUNT_UNAVAILABLE' });

  user.password = newPassword; // hash — pre-save; passwordChangedAt ყველა ძველ სესიას აუქმებს
  await user.save();

  res.json({ message: 'პაროლი წარმატებით შეიცვალა. ახლა შეგიძლიათ შეხვიდეთ ახალი პაროლით.' });
});

module.exports = { changePassword, sendResetCode, resetCodeStatus, verifyResetCode, resetPassword };
