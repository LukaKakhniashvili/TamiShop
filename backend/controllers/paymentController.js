const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const { PAYMENT_BANKS, isPaymentMethodEnabled } = require('../constants/checkout');
const { sandboxAllowed, LIVE_PROVIDERS } = require('../services/payments');
const { startCardPayment, syncCardPayment } = require('../services/orderPayments');
const { getSandboxSession, completeSandboxSession, renderSandboxPage } = require('../services/payments/sandbox');

// შეკვეთა მხოლოდ მისი მფლობელისთვის
const loadOwnOrder = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order || String(order.user) !== String(req.user._id)) {
    res.status(404);
    throw new Error('შეკვეთა ვერ მოიძებნა');
  }
  return order;
};

// @desc    ბანკის გადახდის სესიის შექმნა; აბრუნებს მხოლოდ { sessionId, paymentUrl, provider, mode }
// @route   POST /api/payments/:orderId/init   body: { bank?: 'BOG' | 'TBC' }
// @access  Private
const initPayment = asyncHandler(async (req, res) => {
  const order = await loadOwnOrder(req, res);

  if (order.payment?.method !== 'card') {
    res.status(400);
    throw new Error('ამ შეკვეთისთვის ბარათით გადახდა არ არის არჩეული');
  }
  if (!isPaymentMethodEnabled('card')) {
    res.status(503);
    throw new Error('ბარათით გადახდა დროებით მიუწვდომელია');
  }
  if (order.payment.status === 'paid') {
    return res.status(409).json({ message: 'შეკვეთა უკვე გადახდილია', status: 'paid', order });
  }
  if (order.status === 'cancelled') {
    res.status(409);
    throw new Error('შეკვეთა გაუქმებულია');
  }

  const bank = req.body?.bank || order.payment.provider;
  if (!PAYMENT_BANKS[bank]) {
    res.status(400);
    throw new Error('აირჩიეთ ბანკი');
  }

  try {
    const session = await startCardPayment(order, bank, {
      baseUrl: `${req.protocol}://${req.get('host')}`,
      clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    });
    res.json(session);
  } catch (err) {
    // ბანკის პასუხის დეტალები მხოლოდ სერვერის ლოგში
    console.error(`[payments] ${bank} init failed for ${order.orderNumber}:`, err.status || '', err.data || err.message);
    res.status(err.status === 503 ? 503 : 502).json({
      message: err.status === 503 ? err.message : 'ბანკთან დაკავშირება ვერ მოხერხდა. სცადეთ თავიდან.',
    });
  }
});

// @desc    გადახდის სტატუსი — სერვერი ამოწმებს ბანკთან და საჭიროებისას ადასტურებს შეკვეთას
// @route   GET /api/payments/:orderId/status
// @access  Private
const getPaymentStatus = asyncHandler(async (req, res) => {
  let order = await loadOwnOrder(req, res);
  if (order.payment?.status === 'pending' && order.payment.sessionId) {
    try {
      order = await syncCardPayment(order);
    } catch (err) {
      console.error(`[payments] status check failed for ${order.orderNumber}:`, err.status || '', err.data || err.message);
    }
  }
  res.json({ status: order.payment?.status, message: order.payment?.failureReason || undefined, order });
});

// @desc    ბანკის server-to-server შეტყობინება. შინაარსს არ ვენდობით — მხოლოდ ID-ს ვიღებთ
//          და სტატუსს ბანკის API-ით ვამოწმებთ.
// @route   POST /api/payments/callback/:bank
// @access  Public (ბანკი)
const paymentCallback = asyncHandler(async (req, res) => {
  const provider = LIVE_PROVIDERS[req.params.bank];
  const sessionId = provider?.extractSessionId(req.body);
  if (sessionId) {
    const order = await Order.findOne({ 'payment.sessionId': String(sessionId), 'payment.provider': req.params.bank });
    if (order) {
      try {
        await syncCardPayment(order);
      } catch (err) {
        console.error(`[payments] callback sync failed for ${order.orderNumber}:`, err.status || '', err.data || err.message);
      }
    }
  }
  res.json({ received: true });
});

// ---- სატესტო ბანკის გვერდი (მხოლოდ development) ----

const sandboxGuard = (res) => {
  if (!sandboxAllowed()) {
    res.status(404).send('Not found');
    return false;
  }
  return true;
};

// @route   GET /api/payments/sandbox/:sessionId
const sandboxPage = (req, res) => {
  if (!sandboxGuard(res)) return;
  const session = getSandboxSession(req.params.sessionId);
  if (!session) return res.status(404).send('სატესტო სესია ვერ მოიძებნა ან ვადა გაუვიდა.');
  res.type('html').send(renderSandboxPage(req.params.sessionId, session));
};

// @route   POST /api/payments/sandbox/:sessionId   form: result=approve|decline|cancel
const sandboxComplete = (req, res) => {
  if (!sandboxGuard(res)) return;
  const returnUrl = completeSandboxSession(req.params.sessionId, req.body?.result);
  if (!returnUrl) return res.status(410).send('სესია უკვე დასრულებულია.');
  // ბანკის მსგავსად — ბრაუზერის გადამისამართება მაღაზიის დაბრუნების გვერდზე
  res.redirect(303, returnUrl);
};

module.exports = { initPayment, getPaymentStatus, paymentCallback, sandboxPage, sandboxComplete };
