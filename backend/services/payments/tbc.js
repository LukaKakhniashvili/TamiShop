/*
 * TBC Bank — tpay E-Commerce API (hosted payment page).
 *
 * საჭირო .env ცვლადები:  TBC_API_KEY, TBC_CLIENT_ID, TBC_CLIENT_SECRET
 * არასავალდებულო:         TBC_API_URL (მაგ. სატესტო გარემოს მისამართი)
 *
 * ⚠️ ენდპოინტები და ველები აღებულია TBC-ის საჯარო დოკუმენტაციიდან (developers.tbcbank.ge).
 * live-ზე გაშვებამდე გადაამოწმეთ მერჩანტის დოკუმენტაციასთან და ბანკის სატესტო გარემოში.
 */
const { requestJson, createTokenCache } = require('./http');

const API_URL = process.env.TBC_API_URL || 'https://api.tbcbank.ge/v1/tpay';

const isConfigured = () =>
  Boolean(process.env.TBC_API_KEY && process.env.TBC_CLIENT_ID && process.env.TBC_CLIENT_SECRET);

const getToken = createTokenCache(async () => {
  const data = await requestJson(`${API_URL}/access-token`, {
    method: 'POST',
    headers: { apikey: process.env.TBC_API_KEY },
    form: { client_id: process.env.TBC_CLIENT_ID, client_secret: process.env.TBC_CLIENT_SECRET },
  });
  return { token: data.access_token, expiresIn: data.expires_in };
});

const authHeaders = async () => ({ apikey: process.env.TBC_API_KEY, Authorization: `Bearer ${await getToken()}` });

const createPayment = async ({ order, amount, currency, returnUrl, callbackUrl }) => {
  const data = await requestJson(`${API_URL}/payments`, {
    method: 'POST',
    headers: await authHeaders(),
    body: {
      amount: { currency, total: amount, subTotal: amount, tax: 0, shipping: 0 },
      // TBC-ს აქვს ერთი დაბრუნების მისამართი — შედეგს სერვერი სტატუსის API-ით ადგენს
      returnurl: returnUrl('return'),
      callbackUrl,
      merchantPaymentId: order.orderNumber,
      methods: [5], // 5 — ბარათით გადახდა
      language: 'KA',
      preAuth: false,
      saveCard: false,
      description: `შეკვეთა ${order.orderNumber}`.slice(0, 30),
    },
  });
  const approval = (data.links || []).find((l) => l.rel === 'approval_url');
  return { sessionId: data.payId, paymentUrl: approval?.uri };
};

// TBC status -> ჩვენი სტატუსი
const STATUS_MAP = {
  Succeeded: 'paid',
  Failed: 'failed',
  Expired: 'cancelled',
  CancelPaymentProcessCompleted: 'cancelled',
  Returned: 'failed',
  PartialReturned: 'failed',
};

const getPaymentStatus = async (sessionId) => {
  const data = await requestJson(`${API_URL}/payments/${encodeURIComponent(sessionId)}`, {
    headers: await authHeaders(),
  });
  const masked = data.paymentCardNumber || '';
  return {
    status: STATUS_MAP[data.status] || 'pending',
    transactionId: data.transactionId,
    card: masked ? { brand: undefined, last4: masked.slice(-4) } : undefined,
    message: data.resultCode && data.status !== 'Succeeded' ? `TBC: ${data.resultCode}` : undefined,
  };
};

const extractSessionId = (body) => body?.PaymentId || body?.paymentId || body?.payId || null;

module.exports = { id: 'TBC', isConfigured, createPayment, getPaymentStatus, extractSessionId };
