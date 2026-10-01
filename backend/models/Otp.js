const mongoose = require('mongoose');
const { CODE_PURPOSES, CODE_TTL_SECONDS, buildVerificationCodeSchema } = require('./verificationCodeSchema');

// რეგისტრაციის (ელ. ფოსტის ვერიფიკაციის) კოდები — კოლექცია "otps"
const otpSchema = buildVerificationCodeSchema(CODE_PURPOSES.EMAIL_VERIFICATION);

// დადასტურებული ელ. ფოსტით რეგისტრაციის დასრულების ვადა
const OTP_VERIFIED_WINDOW_SECONDS = 30 * 60;

module.exports = mongoose.model('Otp', otpSchema);
Object.assign(module.exports, { OTP_TTL_SECONDS: CODE_TTL_SECONDS, OTP_VERIFIED_WINDOW_SECONDS });
