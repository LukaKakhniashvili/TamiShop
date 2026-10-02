const emailService = require('../email/emailService');
const { isConfirmedOrder } = require('../../constants/orderStatus');
const { notifyInBackground } = require('./index');

/*
 * შეკვეთის მოვლენები → შეტყობინებები. გამოიძახება მხოლოდ უკვე წარმატებული ცვლილების შემდეგ
 * (services/adminOrders.js, services/orderPayments.js) და ფონურად — სტატუსის ცვლილებას არ აფერხებს
 * და მისი შეცდომა ცვლილებას არ აუქმებს. დუბლირება: dedupeKey (order:<id>:<status>).
 *
 * ტექსტი არ ინახება: template + params — frontend-ი მომხმარებლის მიმდინარე ენაზე აწყობს.
 */

const orderLink = (order) => `/profile?tab=orders&order=${order._id}`;
const ORDER_URL = (order) => `${process.env.CLIENT_URL || 'http://localhost:5173'}${orderLink(order)}`;

const base = (order) => ({
  type: 'order',
  source: 'automatic',
  link: orderLink(order),
  metadata: { orderId: order._id, orderNumber: order.orderNumber },
});

/** შეკვეთა მიღებულია (დადასტურების მომენტში). ელ. წერილი უკვე იგზავნება არსებული დადასტურების წერილით. */
const orderReceived = (order) => {
  if (!order?.user) return;
  notifyInBackground({
    userIds: [order.user],
    channels: ['in_app'],
    notification: {
      ...base(order),
      template: 'order_received',
      params: { orderNumber: order.orderNumber },
      dedupeKey: `order:${order._id}:received`,
    },
  });
};

/** სტატუსის ცვლილება (processing / shipped / completed / cancelled) — in-app + email */
const orderStatusChanged = (order, status) => {
  // ბარათით გადაუხდელი მცდელობა მომხმარებლის შეკვეთებში არ ჩანს — შეტყობინებაც არ სჭირდება
  if (!order?.user || !isConfirmedOrder(order)) return;
  const plain = typeof order.toObject === 'function' ? order.toObject() : order;
  notifyInBackground({
    userIds: [order.user],
    channels: ['in_app', 'email'],
    notification: {
      ...base(order),
      template: 'order_status',
      params: { orderNumber: order.orderNumber, status },
      dedupeKey: `order:${order._id}:${status}`,
    },
    context: {
      email: (user) => emailService.sendOrderStatusEmail({ to: user.email, order: plain, status, orderUrl: ORDER_URL(order) }),
    },
  });
};

module.exports = { orderReceived, orderStatusChanged };
