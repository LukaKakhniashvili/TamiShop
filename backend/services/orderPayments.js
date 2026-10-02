const Order = require('../models/Order');
const User = require('../models/User');
const { reserveStock, orderStockLines } = require('./productVariants');
const { getPaymentProvider } = require('./payments');
const emailService = require('./email/emailService');
const { orderReceived } = require('./notifications/orderEvents');

const CURRENCY = 'GEL';

/**
 * შეკვეთის დადასტურების შემდეგი მოქმედებები: მარაგის განახლება და მომხმარებლის საკონტაქტო
 * მონაცემების შენახვა. კურიერთან გადახდისას — მაშინვე, ბარათით — მხოლოდ გადახდის შემდეგ.
 */
const applyConfirmedOrderEffects = async (order) => {
  // ვარიანტების მარაგი: კურიერთან გადახდისას უკვე დაჯავშნილია შეკვეთის შექმნისას; ბარათით — აქ, გადახდის შემდეგ.
  // (მარტივ პროდუქტს რაოდენობრივი მარაგი არ აქვს — მხოლოდ inStock.)
  const lines = orderStockLines(order);
  if (lines.length && !order.inventory?.reserved) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, 'inventory.reserved': { $ne: true } },
      { $set: { 'inventory.reserved': true } }
    );
    if (claimed) {
      const r = await reserveStock(lines);
      if (!r.ok) console.warn(`[inventory] ${order.orderNumber}: paid order exceeds variant stock — check inventory`);
    }
  }
  const info = order.customerInfo;
  await User.findByIdAndUpdate(order.user, {
    firstName: info.firstName,
    lastName: info.lastName,
    phone: info.phone,
    address: info.address,
  });

  // დადასტურების წერილი — ფონურად; მისი წარუმატებლობა შეკვეთას არ ეხება
  sendOrderConfirmationEmail(order).catch((err) =>
    console.error(`[email] order confirmation for ${order.orderNumber} failed:`, err.message)
  );
  // Notification Center — „შეკვეთა მიღებულია" (in-app; ელ. წერილი — ზემოთ, არსებული დადასტურებით)
  orderReceived(order);
};

/**
 * შეკვეთის დადასტურების წერილი მომხმარებლის რეგისტრირებულ ელ. ფოსტაზე.
 * შედეგი ინახება order.notifications-ში (ადმინისთვის / ხელახლა გაგზავნისთვის).
 */
const sendOrderConfirmationEmail = async (order) => {
  const user = await User.findById(order.user).select('email').lean();
  if (!user?.email) return;
  const result = await emailService.sendOrderConfirmationEmail({
    to: user.email,
    order: typeof order.toObject === 'function' ? order.toObject() : order,
    orderUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?tab=orders`,
  });
  await Order.updateOne(
    { _id: order._id },
    result.sent
      ? { $set: { 'notifications.confirmationEmailSentAt': new Date() }, $unset: { 'notifications.confirmationEmailError': 1 } }
      : { $set: { 'notifications.confirmationEmailError': result.error || (result.mock ? 'SMTP not configured' : 'unknown') } }
  );
};

/** ბანკის გადახდის სესიის შექმნა (ან თავიდან ცდა იმავე შეკვეთისთვის, შესაძლოა სხვა ბანკით) */
const startCardPayment = async (order, bankId, { baseUrl, clientUrl }) => {
  const provider = getPaymentProvider(bankId);
  const returnUrl = (result) =>
    `${clientUrl}/payment/return?order=${order._id}&result=${encodeURIComponent(result)}`;
  const callbackUrl = `${process.env.PUBLIC_API_URL || baseUrl}/api/payments/callback/${bankId}`;

  const { sessionId, paymentUrl } = await provider.createPayment({
    order,
    amount: order.totalPrice,
    currency: CURRENCY,
    returnUrl,
    callbackUrl,
    baseUrl,
  });
  if (!sessionId || !paymentUrl) throw new Error('ბანკმა გადახდის გვერდი ვერ შექმნა');

  order.payment.provider = bankId;
  order.payment.mode = provider.mode;
  order.payment.sessionId = sessionId;
  order.payment.status = 'pending';
  order.payment.failureReason = '';
  await order.save();

  return { sessionId, paymentUrl, provider: bankId, mode: provider.mode };
};

/**
 * სტატუსის სინქრონიზაცია ბანკთან. ყოველთვის ბანკის API-ს ვეკითხებით — არასდროს ვენდობით
 * ბრაუზერის ან callback-ის შინაარსს. გადახდილის დაფიქსირება ატომურია: თუ callback და
 * კლიენტის შემოწმება ერთდროულად მოვიდა, side effects მხოლოდ ერთხელ შესრულდება.
 */
const syncCardPayment = async (order) => {
  const p = order.payment || {};
  if (p.method !== 'card' || !p.sessionId || p.status === 'paid') return order;

  const provider = getPaymentProvider(p.provider, p.mode);
  const result = await provider.getPaymentStatus(p.sessionId);

  if (result.status === 'paid') {
    const set = { 'payment.status': 'paid', 'payment.paidAt': new Date() };
    if (result.transactionId) set['payment.transactionId'] = String(result.transactionId);
    if (result.card?.brand) set['payment.cardBrand'] = result.card.brand;
    if (result.card?.last4) set['payment.cardLast4'] = result.card.last4;

    // მხოლოდ აქტიური (გაუუქმებელი) შეკვეთა დასტურდება
    const paid = await Order.findOneAndUpdate(
      { _id: order._id, status: { $ne: 'cancelled' }, 'payment.sessionId': p.sessionId, 'payment.status': { $ne: 'paid' } },
      { $set: set, $unset: { 'payment.failureReason': 1 } },
      { new: true }
    );
    if (paid) {
      await applyConfirmedOrderEffects(paid);
      return paid;
    }

    // ძველი სესიით გადახდა უკვე გაუქმებულ შეკვეთაზე (მაგ. კალათა შეიცვალა): შეკვეთა არ
    // აქტიურდება, მარაგი არ იცვლება — თანხა მოითხოვს დაბრუნებას (ადმინი ხედავს)
    const late = await Order.findOneAndUpdate(
      { _id: order._id, status: 'cancelled', 'payment.sessionId': p.sessionId, 'payment.status': { $ne: 'paid' } },
      {
        $set: {
          ...set,
          'payment.refundRequired': true,
          'payment.failureReason': 'გადახდა შესრულდა უკვე გაუქმებულ შეკვეთაზე — საჭიროა თანხის დაბრუნება',
        },
      },
      { new: true }
    );
    if (late) console.warn(`[payments] late payment on cancelled order ${late.orderNumber} — refund required`);
    return late || Order.findById(order._id);
  }

  if (result.status === 'failed' || result.status === 'cancelled') {
    return (
      (await Order.findOneAndUpdate(
        { _id: order._id, 'payment.sessionId': p.sessionId, 'payment.status': 'pending' },
        {
          $set: {
            'payment.status': result.status,
            'payment.failureReason': result.message || (result.status === 'cancelled' ? 'გადახდა გაუქმდა' : 'გადახდა უარყოფილია'),
          },
        },
        { new: true }
      )) || Order.findById(order._id)
    );
  }

  return order; // ჯერ კიდევ მიმდინარეობს
};

/**
 * გადაუხდელი (ბარათით) შეკვეთის გაუქმება: შეკვეთა → cancelled, გადახდის სესია ბათილდება.
 * გამოიყენება, როცა მომხმარებელი აუქმებს შეკვეთას ან ცვლის კალათას — ძველი სესიით (ძველი
 * თანხით) გადახდა აღარ უნდა დადასტურდეს.
 * @returns {{ order, alreadyPaid: boolean }}
 */
const cancelUnpaidOrder = async (order, reason = 'მომხმარებელმა გააუქმა') => {
  const sessionId = order.payment?.sessionId;
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, 'payment.status': { $ne: 'paid' }, status: { $nin: ['cancelled', 'completed'] } },
    { $set: { status: 'cancelled', 'payment.status': 'cancelled', 'payment.failureReason': reason } },
    { new: true }
  );

  if (!updated) {
    const current = await Order.findById(order._id);
    return { order: current, alreadyPaid: current?.payment?.status === 'paid' && current.status !== 'cancelled' };
  }

  // ბანკის სესიის გაუქმება, თუ პროვაიდერს ეს შეუძლია (სხვა შემთხვევაში სესიას ვადა გაუვა,
  // ხოლო მისით შესრულებული გადახდა syncCardPayment-ში შეკვეთას აღარ ააქტიურებს)
  if (sessionId && updated.payment?.provider) {
    try {
      const provider = getPaymentProvider(updated.payment.provider, updated.payment.mode);
      if (provider.cancelPayment) await provider.cancelPayment(sessionId);
    } catch (err) {
      console.error(`[payments] could not cancel session for ${updated.orderNumber}:`, err.message);
    }
  }
  return { order: updated, alreadyPaid: false };
};

module.exports = { applyConfirmedOrderEffects, startCardPayment, syncCardPayment, cancelUnpaidOrder };
