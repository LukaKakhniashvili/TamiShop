/*
 * Bank of Georgia — Payments API (hosted payment page).
 *
 * საჭირო .env ცვლადები:  BOG_CLIENT_ID, BOG_CLIENT_SECRET
 * არასავალდებულო:         BOG_AUTH_URL, BOG_API_URL (თუ ბანკი სხვა მისამართს მოგცემთ, მაგ. სატესტოს)
 *
 * ⚠️ ენდპოინტები და ველები აღებულია BOG-ის საჯარო დოკუმენტაციიდან. live-ზე გაშვებამდე
 * გადაამოწმეთ მერჩანტის დოკუმენტაციასთან (https://api.bog.ge/docs) და ბანკის სატესტო გარემოში.
 */
const crypto = require('crypto');
const { requestJson, createTokenCache } = require('./http');

const AUTH_URL = process.env.BOG_AUTH_URL || 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const API_URL = process.env.BOG_API_URL || 'https://api.bog.ge/payments/v1';

const isConfigured = () => Boolean(process.env.BOG_CLIENT_ID && process.env.BOG_CLIENT_SECRET);

const getToken = createTokenCache(async () => {
  const basic = Buffer.from(`${process.env.BOG_CLIENT_ID}:${process.env.BOG_CLIENT_SECRET}`).toString('base64');
  const data = await requestJson(AUTH_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
    form: { grant_type: 'client_credentials' },
  });
  return { token: data.access_token, expiresIn: data.expires_in };
});

const createPayment = async ({ order, amount, currency, returnUrl, callbackUrl }) => {
  const token = await getToken();
  const data = await requestJson(`${API_URL}/ecommerce/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Language': 'ka',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: {
      callback_url: callbackUrl,
      external_order_id: order.orderNumber,
      purchase_units: {
        currency,
        total_amount: amount,
        basket: order.items.map((i) => ({
          product_id: String(i.product),
          description: i.name.slice(0, 100),
          quantity: i.quantity,
          unit_price: i.price,
        })),
      },
      redirect_urls: { success: returnUrl('success'), fail: returnUrl('fail') },
    },
  });
  return { sessionId: data.id, paymentUrl: data._links?.redirect?.href };
};

// BOG order_status.key -> ჩვენი სტატუსი
const STATUS_MAP = {
  completed: 'paid',
  rejected: 'failed',
  blocked: 'failed',
  refunded: 'failed',
  refunded_partially: 'failed',
};

const getPaymentStatus = async (sessionId) => {
  const token = await getToken();
  const data = await requestJson(`${API_URL}/receipt/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'ka' },
  });
  const key = data.order_status?.key;
  const detail = data.payment_detail || {};
  const masked = detail.payer_identifier || '';
  return {
    status: STATUS_MAP[key] || 'pending',
    transactionId: detail.transaction_id,
    card: masked ? { brand: detail.card_type, last4: masked.slice(-4) } : undefined,
    message: data.reject_reason || undefined,
  };
};

// callback-ის სხეულიდან მხოლოდ ID-ს ვიღებთ — სტატუსს ყოველთვის API-ით ვამოწმებთ
const extractSessionId = (body) => body?.body?.order_id || body?.order_id || null;

module.exports = { id: 'BOG', isConfigured, createPayment, getPaymentStatus, extractSessionId };
