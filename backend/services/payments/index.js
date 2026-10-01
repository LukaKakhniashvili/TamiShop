/*
 * გადახდის პროვაიდერები (ბანკის დაცული გადახდის გვერდი).
 *
 * ყველა პროვაიდერი ახორციელებს ერთსა და იმავე ინტერფეისს:
 *   createPayment({ order, amount, currency, returnUrl(result), callbackUrl, baseUrl })
 *     => { sessionId, paymentUrl }                  — ბანკის სესია და გადახდის გვერდის მისამართი
 *   getPaymentStatus(sessionId)
 *     => { status: 'pending'|'paid'|'failed'|'cancelled', transactionId?, card?: { brand, last4 }, message? }
 *   extractSessionId(callbackBody) => sessionId | null
 *
 * ბარათის მონაცემებს მხოლოდ ბანკის გვერდი იღებს. ბანკის credentials მხოლოდ სერვერზეა (.env).
 *
 * რეჟიმი თითოეული ბანკისთვის:
 *   - credentials მითითებულია  → რეალური API (bog.js / tbc.js)
 *   - არ არის და არა production → სატესტო გვერდი (sandbox.js)
 *   - არ არის და production     → ბანკი მიუწვდომელია
 */
const bog = require('./bog');
const tbc = require('./tbc');
const { createSandboxProvider } = require('./sandbox');

const LIVE = { BOG: bog, TBC: tbc };
const SANDBOX = { BOG: createSandboxProvider('BOG'), TBC: createSandboxProvider('TBC') };

const sandboxAllowed = () => process.env.NODE_ENV !== 'production' || process.env.ALLOW_SANDBOX_PAYMENTS === 'true';

/** @returns {'live' | 'sandbox' | null} */
const getProviderMode = (bankId) => {
  if (LIVE[bankId]?.isConfigured()) return 'live';
  if (SANDBOX[bankId] && sandboxAllowed()) return 'sandbox';
  return null;
};

const getPaymentProvider = (bankId, mode = getProviderMode(bankId)) => {
  if (mode === 'live') return { ...LIVE[bankId], mode: 'live' };
  if (mode === 'sandbox' && sandboxAllowed()) return SANDBOX[bankId];
  const err = new Error('არჩეული ბანკით გადახდა დროებით მიუწვდომელია');
  err.status = 503;
  throw err;
};

module.exports = { getPaymentProvider, getProviderMode, sandboxAllowed, LIVE_PROVIDERS: LIVE };
