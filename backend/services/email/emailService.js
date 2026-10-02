const { sendEmail } = require('./mailer');
const { verificationEmail, passwordResetEmail, orderConfirmationEmail, orderStatusEmail } = require('./templates');

/*
 * ტრანზაქციული წერილები — ყველა იყენებს ერთსა და იმავე sendEmail-ს (transporter, გამგზავნი,
 * ჰედერები, შეცდომების დამუშავება, ლოგირება). განსხვავდება მხოლოდ შაბლონი.
 * lng (ka | en | ru) — წერილის ენა; უცნობის/არარსებობისას — ქართული.
 */

/** რეგისტრაციის ვერიფიკაციის კოდი */
const sendVerificationEmail = ({ to, code, expiresInMinutes, lng }) =>
  sendEmail({ type: 'verification', to, ...verificationEmail({ code, expiresInMinutes, lng }) });

/** პაროლის აღდგენის კოდი */
const sendPasswordResetEmail = ({ to, code, expiresInMinutes, lng }) =>
  sendEmail({ type: 'password_reset', to, ...passwordResetEmail({ code, expiresInMinutes, lng }) });

/** შეკვეთის დადასტურება */
const sendOrderConfirmationEmail = ({ to, order, orderUrl, lng }) =>
  sendEmail({ type: 'order_confirmation', to, ...orderConfirmationEmail({ order, orderUrl, lng: lng || order.language }) });

/** შეკვეთის სტატუსის ცვლილება (Notification Center-ის email არხი) */
const sendOrderStatusEmail = ({ to, order, status, orderUrl, lng }) =>
  sendEmail({ type: 'order_status', to, ...orderStatusEmail({ order, status, orderUrl, lng: lng || order.language }) });

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOrderConfirmationEmail, sendOrderStatusEmail };
