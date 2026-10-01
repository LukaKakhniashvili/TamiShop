const crypto = require('crypto');
const mongoose = require('mongoose');

/*
 * ერთჯერადი კოდების საერთო სქემა. თითოეული დანიშნულება (purpose) ცალკე კოლექციაშია და კოდის hash-ში
 * დანიშნულებაც შედის — რეგისტრაციის კოდი პაროლის აღდგენისთვის (და პირიქით) ვერ გამოდგება.
 */

const CODE_PURPOSES = { EMAIL_VERIFICATION: 'EMAIL_VERIFICATION', PASSWORD_RESET: 'PASSWORD_RESET' };

// კოდის მოქმედების ვადა (წამებში) — ამოწმებს სერვერი (expiresAt), გამოიყენება წერილის ტექსტშიც
const CODE_TTL_SECONDS = 180;
// ახალი კოდის მოთხოვნამდე მინიმალური ლოდინი
const CODE_RESEND_COOLDOWN_SECONDS = 30;
// არასწორი მცდელობების ლიმიტი ერთ კოდზე — შემდეგ საჭიროა ახალი კოდი
const CODE_MAX_ATTEMPTS = 5;
// ვადაგასული ჩანაწერი ცოტა ხანს რჩება, რომ მომხმარებელს „ვადა ამოიწურა" ვუთხრათ და არა „ვერ მოიძებნა"
const CODE_PURGE_AFTER_SECONDS = 60 * 60;

// კოდი ბაზაში ღია სახით არ ინახება
const hashCode = (purpose, email, code) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'otp')
    .update(`${purpose}:${String(email).toLowerCase()}:${String(code)}`)
    .digest('hex');

const buildVerificationCodeSchema = (purpose, extraFields = {}) => {
  const schema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date },
    // MongoDB TTL — მხოლოდ ბაზის დასუფთავებისთვის; ვადას ამოწმებს კოდი (expiresAt)
    purgeAt: { type: Date, required: true, expires: 0 },
    ...extraFields,
  });

  schema.statics.purpose = purpose;
  schema.statics.hashCode = (email, code) => hashCode(purpose, email, code);

  schema.methods.matches = function (code) {
    if (!this.codeHash) return false;
    const a = Buffer.from(this.codeHash, 'hex');
    const b = Buffer.from(hashCode(purpose, this.email, code), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  return schema;
};

module.exports = {
  CODE_PURPOSES,
  CODE_TTL_SECONDS,
  CODE_RESEND_COOLDOWN_SECONDS,
  CODE_MAX_ATTEMPTS,
  CODE_PURGE_AFTER_SECONDS,
  buildVerificationCodeSchema,
};
