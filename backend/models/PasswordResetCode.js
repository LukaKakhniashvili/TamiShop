const mongoose = require('mongoose');
const { CODE_PURPOSES, buildVerificationCodeSchema } = require('./verificationCodeSchema');

/*
 * პაროლის აღდგენის კოდები — ცალკე კოლექცია "passwordresetcodes".
 * კოდის დადასტურების შემდეგ გაიცემა მოკლევადიანი, ერთჯერადი reset token (ბაზაში მხოლოდ მისი hash),
 * პაროლის საბოლოო შეცვლა ხდება მხოლოდ ამ token-ით — ფრონტენდიდან მოსულ ელ. ფოსტას არ ვენდობით.
 */
const passwordResetCodeSchema = buildVerificationCodeSchema(CODE_PURPOSES.PASSWORD_RESET, {
  resetTokenHash: { type: String, index: true, sparse: true },
  resetTokenExpiresAt: { type: Date },
});

// reset token-ის მოქმედების ვადა (კოდის დადასტურებიდან ახალი პაროლის დაყენებამდე)
const RESET_TOKEN_TTL_SECONDS = 10 * 60;

module.exports = mongoose.model('PasswordResetCode', passwordResetCodeSchema);
Object.assign(module.exports, { RESET_TOKEN_TTL_SECONDS });
