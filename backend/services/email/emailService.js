const { sendEmail } = require('./mailer');
const { verificationEmail, passwordResetEmail, orderConfirmationEmail } = require('./templates');

/*
 * ტრანზაქციული წერილები — ყველა იყენებს ერთსა და იმავე sendEmail-ს (transporter, გამგზავნი,
 * ჰედერები, შეცდომების დამუშავება, ლოგირება). განსხვავდება მხოლოდ შაბლონი.
 */

/** რეგისტრაციის ვერიფიკაციის კოდი */
const sendVerificationEmail = ({ to, code, expiresInMinutes }) =>
  sendEmail({ type: 'verification', to, ...verificationEmail({ code, expiresInMinutes }) });

/** პაროლის აღდგენის კოდი */
const sendPasswordResetEmail = ({ to, code, expiresInMinutes }) =>
  sendEmail({ type: 'password_reset', to, ...passwordResetEmail({ code, expiresInMinutes }) });

/** შეკვეთის დადასტურება */
const sendOrderConfirmationEmail = ({ to, order, orderUrl }) =>
  sendEmail({ type: 'order_confirmation', to, ...orderConfirmationEmail({ order, orderUrl }) });

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOrderConfirmationEmail };
