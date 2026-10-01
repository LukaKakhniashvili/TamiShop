const rateLimit = require('./rateLimit');

// ავტორიზაციის მგრძნობიარე endpoint-ების ლიმიტები — ერთი ინსტანცია, რომ ძველ (/api/auth/...) და ახალ
// მისამართებს საერთო მთვლელი ჰქონდეთ და ლიმიტის გვერდის ავლა ვერ მოხერხდეს
const FIFTEEN_MIN = 15 * 60 * 1000;

module.exports = {
  limitCodeSend: rateLimit({ windowMs: FIFTEEN_MIN, max: 20 }),
  limitCodeVerify: rateLimit({ windowMs: FIFTEEN_MIN, max: 30 }),
  limitResetSend: rateLimit({ windowMs: FIFTEEN_MIN, max: 10 }),
  limitResetVerify: rateLimit({ windowMs: FIFTEEN_MIN, max: 30 }),
  limitResetComplete: rateLimit({ windowMs: FIFTEEN_MIN, max: 10 }),
  // მიმდინარე პაროლის გამოცნობის წინააღმდეგ — მომხმარებელზე (protect-ის შემდეგ)
  limitPasswordChange: rateLimit({ windowMs: FIFTEEN_MIN, max: 10, key: (req) => `user:${req.user._id}` }),
};
