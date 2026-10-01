const { sendEmail } = require('./mailer');
const { verificationEmail, orderConfirmationEmail } = require('./templates');

/*
 * ტრანზაქციული წერილები — ორივე იყენებს ერთსა და იმავე sendEmail-ს (transporter, გამგზავნი,
 * ჰედერები, შეცდომების დამუშავება, ლოგირება). განსხვავდება მხოლოდ შაბლონი.
 */

/** რეგისტრაციის ვერიფიკაციის კოდი */
const sendVerificationEmail = ({ to, code, expiresInMinutes }) =>
  sendEmail({ type: 'verification', to, ...verificationEmail({ code, expiresInMinutes }) });

/** შეკვეთის დადასტურება */
const sendOrderConfirmationEmail = ({ to, order, orderUrl }) =>
  sendEmail({ type: 'order_confirmation', to, ...orderConfirmationEmail({ order, orderUrl }) });

module.exports = { sendVerificationEmail, sendOrderConfirmationEmail };
