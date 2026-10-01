const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendVerificationEmail } = require('../services/email/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @desc    Google-ით ავტორიზაცია (frontend გვაწვდის Google ID token-ს)
// @route   POST /api/auth/google
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

  res.json({
    token: generateToken(user._id),
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// @desc    რეგისტრაცია (ელ. ფოსტით, პაროლით და OTP-ით)
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, email, password, city, street, code } = req.body;

  if (!firstName || !email || !password || !code) {
    res.status(400);
    throw new Error('ყველა სავალდებულო ველი უნდა იყოს შევსებული');
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    res.status(400);
    throw new Error('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს, ერთ დიდ ასოს და ერთ ციფრს');
  }

  // ელ. ფოსტა დადასტურებული უნდა იყოს (verify-ით) იმავე კოდით და ბოლო 30 წუთში
  const otpRecord = await Otp.findOne({ email: email.toLowerCase() });
  const verifiedRecently =
    otpRecord?.codeHash &&
    otpRecord.verifiedAt &&
    Date.now() - otpRecord.verifiedAt.getTime() < Otp.OTP_VERIFIED_WINDOW_SECONDS * 1000 &&
    otpRecord.matches(String(code));
  if (!verifiedRecently) {
    res.status(400);
    const err = new Error('ელ. ფოსტის ვერიფიკაციის ვადა ამოიწურა. გთხოვთ, დაადასტუროთ ელ. ფოსტა თავიდან.');
    err.details = { code: 'VERIFICATION_REQUIRED' };
    throw err;
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

  res.status(201).json({
    token: generateToken(user._id),
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// @desc    ავტორიზაცია (ელ. ფოსტით და პაროლით)
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('ელ. ფოსტა და პაროლი სავალდებულოა');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('ელ. ფოსტა ან პაროლი არასწორია');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('თქვენი ანგარიში დეაქტივირებულია');
  }

  res.json({
    token: generateToken(user._id),
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      avatar: user.avatar,
    },
  });
});

// ---------------------------------------------------------------------------
// ელ. ფოსტის ვერიფიკაციის კოდი — სერვერი არის ერთადერთი წყარო: კოდის გენერაცია, ვადა (expiresAt),
// ხელახლა გაგზავნის ლოდინი (lastSentAt + 30 წმ), მცდელობების ლიმიტი და შემოწმება.
// კოდი არც პასუხში ბრუნდება და არც ბაზაში ინახება ღია სახით.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const secondsUntil = (date, now = Date.now()) => Math.max(0, Math.ceil((new Date(date).getTime() - now) / 1000));

// ტაიმერები წამებში (არა აბსოლუტური დრო) — ბრაუზერის საათის აცდენა გავლენას არ ახდენს
const codeTimers = (otp, now = Date.now()) => ({
  codeValiditySeconds: Otp.OTP_TTL_SECONDS,
  expiresInSeconds: secondsUntil(otp.expiresAt, now),
  resendAvailableInSeconds: secondsUntil(otp.lastSentAt.getTime() + Otp.OTP_RESEND_COOLDOWN_SECONDS * 1000, now),
});

const rejectCooldown = (res, waitSeconds) => {
  res.status(429).set('Retry-After', String(waitSeconds));
  const err = new Error(`ახალი კოდის მოთხოვნა შესაძლებელია ${waitSeconds} წამში`);
  err.details = { code: 'RESEND_COOLDOWN', resendAvailableInSeconds: waitSeconds };
  throw err;
};

// @desc    ვერიფიკაციის კოდის გაგზავნა / ხელახლა გაგზავნა
// @route   POST /api/auth-verification-code-send
// @access  Public
const sendOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) {
    res.status(400);
    throw new Error('შეიყვანეთ სწორი ელ. ფოსტა');
  }

  if (await User.exists({ email })) {
    res.status(400);
    throw new Error('მომხმარებელი ამ ელ. ფოსტით უკვე არსებობს');
  }

  const now = Date.now();
  const code = String(crypto.randomInt(1000, 10000));

  // ატომური შემოწმება + ჩაწერა: ჩანაწერი განახლდება მხოლოდ მაშინ, თუ ლოდინის დრო გასულია.
  // თუ ბოლო გაგზავნა 30 წამზე ახალია, ფილტრს არაფერი ემთხვევა → upsert-ი unique email-ზე ეჯახება (E11000).
  let otp;
  try {
    otp = await Otp.findOneAndUpdate(
      {
        email,
        $or: [{ lastSentAt: { $lte: new Date(now - Otp.OTP_RESEND_COOLDOWN_SECONDS * 1000) } }, { lastSentAt: { $exists: false } }],
      },
      {
        $set: {
          codeHash: Otp.hashCode(email, code), // წინა კოდი ამით უქმდება
          expiresAt: new Date(now + Otp.OTP_TTL_SECONDS * 1000),
          lastSentAt: new Date(now),
          attempts: 0,
          purgeAt: new Date(now + Otp.OTP_PURGE_AFTER_SECONDS * 1000),
        },
        $unset: { verifiedAt: 1, code: 1, createdAt: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    const current = await Otp.findOne({ email }).select('lastSentAt').lean();
    const resendAt = current?.lastSentAt ? current.lastSentAt.getTime() + Otp.OTP_RESEND_COOLDOWN_SECONDS * 1000 : now;
    rejectCooldown(res, Math.max(1, secondsUntil(resendAt, now)));
  }

  // წარმატება ბრუნდება მხოლოდ მას შემდეგ, რაც SMTP სერვერმა წერილი მიიღო
  const result = await sendVerificationEmail({
    to: email,
    code,
    expiresInMinutes: Math.round(Otp.OTP_TTL_SECONDS / 60),
  });
  if (!result.sent && !result.mock) {
    // წერილი არ გაიგზავნა — კოდი უქმდება, რომ მომხმარებელმა ლოდინის გარეშე სცადოს თავიდან
    await Otp.deleteOne({ _id: otp._id });
    res.status(502);
    throw new Error('ვერიფიკაციის კოდის გაგზავნა ვერ მოხერხდა. სცადეთ ცოტა ხანში.');
  }

  res.json({ message: 'ვერიფიკაციის კოდი გაიგზავნა', ...codeTimers(otp) });
});

// @desc    აქტიური კოდის ტაიმერები (გვერდის განახლების შემდეგ აღსადგენად). კოდს არ აბრუნებს.
// @route   GET /api/auth-verification-code-status?email=
// @access  Public
const otpStatus = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.query.email);
  const otp = EMAIL_RE.test(email) ? await Otp.findOne({ email }).select('expiresAt lastSentAt verifiedAt codeHash').lean() : null;
  if (!otp?.codeHash || !otp.lastSentAt) return res.json({ active: false, resendAvailableInSeconds: 0 });
  const timers = codeTimers(otp);
  res.json({ active: timers.expiresInSeconds > 0 && !otp.verifiedAt, ...timers });
});

// @desc    ვერიფიკაციის კოდის შემოწმება
// @route   POST /api/auth-verification-code-verify
// @access  Public
const verifyOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !code) {
    res.status(400);
    throw new Error('ელ. ფოსტა და კოდი სავალდებულოა');
  }

  const otp = await Otp.findOne({ email });
  const fail = (status, message, reason) => {
    res.status(status);
    const err = new Error(message);
    err.details = { code: reason };
    throw err;
  };

  if (!otp?.codeHash) fail(400, 'ვერიფიკაციის კოდი ვერ მოიძებნა. გთხოვთ, მოითხოვოთ ახალი კოდი.', 'CODE_NOT_FOUND');
  if (otp.expiresAt.getTime() <= Date.now()) {
    fail(400, 'ვერიფიკაციის კოდის ვადა ამოიწურა. გთხოვთ, მოითხოვოთ ახალი კოდი.', 'CODE_EXPIRED');
  }
  if (otp.attempts >= Otp.OTP_MAX_ATTEMPTS) {
    fail(429, 'მცდელობების ლიმიტი ამოიწურა. გთხოვთ, მოითხოვოთ ახალი კოდი.', 'TOO_MANY_ATTEMPTS');
  }

  if (!otp.matches(code)) {
    const { attempts } = await Otp.findByIdAndUpdate(otp._id, { $inc: { attempts: 1 } }, { new: true }).lean();
    const left = Math.max(0, Otp.OTP_MAX_ATTEMPTS - attempts);
    fail(400, left ? `კოდი არასწორია. დარჩენილი მცდელობა: ${left}` : 'კოდი არასწორია. მცდელობების ლიმიტი ამოიწურა — მოითხოვეთ ახალი კოდი.', 'CODE_INVALID');
  }

  // დადასტურებულია — რეგისტრაციის დასრულებას 30 წუთი აქვს (ფორმის შევსებას 3 წუთზე მეტი შეიძლება დასჭირდეს)
  const now = Date.now();
  otp.verifiedAt = new Date(now);
  otp.purgeAt = new Date(now + Otp.OTP_VERIFIED_WINDOW_SECONDS * 1000);
  await otp.save();

  res.json({ success: true, message: 'ელ. ფოსტა დადასტურდა' });
});

// @desc    მიმდინარე ავტორიზებული მომხმარებლის მონაცემები
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// @desc    მომხმარებლის პროფილის განახლება
// @route   PUT /api/auth/me
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

module.exports = { googleLogin, register, login, sendOtp, otpStatus, verifyOtp, getMe, updateMe };
