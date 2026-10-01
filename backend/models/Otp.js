const crypto = require('crypto');
const mongoose = require('mongoose');

// კოდის მოქმედების ვადა (წამებში) — ამოწმებს სერვერი (expiresAt), გამოიყენება წერილის ტექსტშიც
const OTP_TTL_SECONDS = 180;
// ახალი კოდის მოთხოვნამდე მინიმალური ლოდინი
const OTP_RESEND_COOLDOWN_SECONDS = 30;
// არასწორი მცდელობების ლიმიტი ერთ კოდზე — შემდეგ საჭიროა ახალი კოდი
const OTP_MAX_ATTEMPTS = 5;
// დადასტურებული ელ. ფოსტით რეგისტრაციის დასრულების ვადა
const OTP_VERIFIED_WINDOW_SECONDS = 30 * 60;
// ვადაგასული ჩანაწერი ცოტა ხანს რჩება, რომ მომხმარებელს „ვადა ამოიწურა" ვუთხრათ და არა „ვერ მოიძებნა"
const OTP_PURGE_AFTER_SECONDS = 60 * 60;

// კოდი ბაზაში ღია სახით არ ინახება
const hashCode = (email, code) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'otp')
    .update(`${String(email).toLowerCase()}:${String(code)}`)
    .digest('hex');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  lastSentAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  verifiedAt: { type: Date },
  // MongoDB TTL — მხოლოდ ბაზის დასუფთავებისთვის; ვადას ამოწმებს კოდი (expiresAt)
  purgeAt: { type: Date, required: true, expires: 0 },
});

otpSchema.methods.matches = function (code) {
  const a = Buffer.from(this.codeHash, 'hex');
  const b = Buffer.from(hashCode(this.email, code), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = mongoose.model('Otp', otpSchema);
Object.assign(module.exports, {
  OTP_TTL_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_VERIFIED_WINDOW_SECONDS,
  OTP_PURGE_AFTER_SECONDS,
  hashCode,
});
