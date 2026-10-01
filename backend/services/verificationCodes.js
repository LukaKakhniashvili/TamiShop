const crypto = require('crypto');
const httpError = require('../utils/httpError');
const {
  CODE_TTL_SECONDS,
  CODE_RESEND_COOLDOWN_SECONDS,
  CODE_MAX_ATTEMPTS,
  CODE_PURGE_AFTER_SECONDS,
} = require('../models/verificationCodeSchema');

/*
 * ერთჯერადი კოდების საერთო ლოგიკა (რეგისტრაცია, პაროლის აღდგენა). სერვერი არის ერთადერთი წყარო:
 * კოდის გენერაცია, ვადა (expiresAt), ხელახლა გაგზავნის ლოდინი (lastSentAt + 30 წმ), მცდელობების
 * ლიმიტი და შემოწმება. კოდი არც პასუხში ბრუნდება, არც ლოგში იწერება და ბაზაში მხოლოდ hash ინახება.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) => EMAIL_RE.test(email) && email.length <= 254;
const secondsUntil = (date, now = Date.now()) => Math.max(0, Math.ceil((new Date(date).getTime() - now) / 1000));

// ტაიმერები წამებში (არა აბსოლუტური დრო) — ბრაუზერის საათის აცდენა გავლენას არ ახდენს
const codeTimers = (doc, now = Date.now()) => ({
  codeValiditySeconds: CODE_TTL_SECONDS,
  expiresInSeconds: secondsUntil(doc.expiresAt, now),
  resendAvailableInSeconds: secondsUntil(doc.lastSentAt.getTime() + CODE_RESEND_COOLDOWN_SECONDS * 1000, now),
});

const cooldownError = (waitSeconds) =>
  Object.assign(
    httpError(429, `ახალი კოდის მოთხოვნა შესაძლებელია ${waitSeconds} წამში`, {
      code: 'RESEND_COOLDOWN',
      resendAvailableInSeconds: waitSeconds,
    }),
    { headers: { 'Retry-After': String(waitSeconds) } }
  );

/**
 * ახალი კოდის გაცემა და გაგზავნა. წინა კოდი უქმდება (იცვლება hash), ვადა და ლოდინი თავიდან იწყება.
 * წარმატება ბრუნდება მხოლოდ მას შემდეგ, რაც SMTP სერვერმა წერილი მიიღო.
 *
 * @param {import('mongoose').Model} Model  — Otp ან PasswordResetCode
 * @param {string} email                   — ნორმალიზებული ელ. ფოსტა
 * @param {(code: string, minutes: number) => Promise<{sent:boolean, mock?:boolean}>} deliver
 */
const issueCode = async (Model, email, deliver) => {
  const now = Date.now();
  const code = String(crypto.randomInt(1000, 10000));

  // ატომური შემოწმება + ჩაწერა: ჩანაწერი განახლდება მხოლოდ მაშინ, თუ ლოდინის დრო გასულია.
  // თუ ბოლო გაგზავნა 30 წამზე ახალია, ფილტრს არაფერი ემთხვევა → upsert-ი unique email-ზე ეჯახება (E11000).
  let doc;
  try {
    doc = await Model.findOneAndUpdate(
      {
        email,
        $or: [{ lastSentAt: { $lte: new Date(now - CODE_RESEND_COOLDOWN_SECONDS * 1000) } }, { lastSentAt: { $exists: false } }],
      },
      {
        $set: {
          codeHash: Model.hashCode(email, code),
          expiresAt: new Date(now + CODE_TTL_SECONDS * 1000),
          lastSentAt: new Date(now),
          attempts: 0,
          purgeAt: new Date(now + CODE_PURGE_AFTER_SECONDS * 1000),
        },
        // წინა დადასტურება / reset token უქმდება
        $unset: { verifiedAt: 1, resetTokenHash: 1, resetTokenExpiresAt: 1, code: 1, createdAt: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    const current = await Model.findOne({ email }).select('lastSentAt').lean();
    const resendAt = current?.lastSentAt ? current.lastSentAt.getTime() + CODE_RESEND_COOLDOWN_SECONDS * 1000 : now;
    throw cooldownError(Math.max(1, secondsUntil(resendAt, now)));
  }

  const result = await deliver(code, Math.round(CODE_TTL_SECONDS / 60));
  if (!result.sent && !result.mock) {
    // წერილი არ გაიგზავნა — კოდი უქმდება, რომ მომხმარებელმა ლოდინის გარეშე სცადოს თავიდან
    await Model.deleteOne({ _id: doc._id });
    throw httpError(502, 'ვერიფიკაციის კოდის გაგზავნა ვერ მოხერხდა. სცადეთ ცოტა ხანში.', { code: 'EMAIL_FAILED' });
  }
  return codeTimers(doc);
};

/** აქტიური კოდის ტაიმერები (გვერდის განახლების შემდეგ აღსადგენად). კოდს არ აბრუნებს. */
const codeStatus = async (Model, email) => {
  const doc = isValidEmail(email)
    ? await Model.findOne({ email }).select('expiresAt lastSentAt verifiedAt codeHash').lean()
    : null;
  if (!doc?.codeHash || !doc.lastSentAt) return { active: false, resendAvailableInSeconds: 0 };
  const timers = codeTimers(doc);
  return { active: timers.expiresInSeconds > 0 && !doc.verifiedAt, ...timers };
};

/**
 * კოდის შემოწმება: არსებობა, ვადა, მცდელობების ლიმიტი, დამთხვევა.
 * წარმატებისას აბრუნებს დოკუმენტს (დადასტურებულად მონიშვნას აკეთებს გამომძახებელი).
 */
const checkCode = async (Model, email, code) => {
  const doc = await Model.findOne({ email });
  if (!doc?.codeHash || doc.verifiedAt) {
    throw httpError(400, 'ვერიფიკაციის კოდი ვერ მოიძებნა. გთხოვთ, მოითხოვოთ ახალი კოდი.', { code: 'CODE_NOT_FOUND' });
  }
  if (doc.expiresAt.getTime() <= Date.now()) {
    throw httpError(400, 'ვერიფიკაციის კოდის ვადა ამოიწურა. გთხოვთ, მოითხოვოთ ახალი კოდი.', { code: 'CODE_EXPIRED' });
  }
  if (doc.attempts >= CODE_MAX_ATTEMPTS) {
    throw httpError(429, 'მცდელობების ლიმიტი ამოიწურა. გთხოვთ, მოითხოვოთ ახალი კოდი.', { code: 'TOO_MANY_ATTEMPTS' });
  }
  if (!doc.matches(code)) {
    const { attempts } = await Model.findByIdAndUpdate(doc._id, { $inc: { attempts: 1 } }, { new: true }).lean();
    const left = Math.max(0, CODE_MAX_ATTEMPTS - attempts);
    throw httpError(
      400,
      left ? `კოდი არასწორია. დარჩენილი მცდელობა: ${left}` : 'კოდი არასწორია. მცდელობების ლიმიტი ამოიწურა — მოითხოვეთ ახალი კოდი.',
      { code: 'CODE_INVALID', attemptsLeft: left }
    );
  }
  return doc;
};

module.exports = { normalizeEmail, isValidEmail, issueCode, codeStatus, checkCode };
