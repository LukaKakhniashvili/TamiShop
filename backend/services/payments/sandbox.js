/*
 * სატესტო (sandbox) პროვაიდერი — გამოიყენება, სანამ ბანკის credentials არ არის მითითებული.
 *
 * იმეორებს რეალური ბანკის ნაკადს: სესიის შექმნა → გადახდის გვერდის URL → დაბრუნება → სტატუსის
 * შემოწმება. გვერდს ემსახურება ჩვენივე backend (GET /api/payments/sandbox/:sessionId) და მას
 * არ აქვს ბარათის ველები — მხოლოდ შედეგის სიმულაცია (დადასტურება / უარყოფა / გაუქმება).
 * production-ში გამორთულია (იხ. index.js).
 */
const crypto = require('crypto');
const { PAYMENT_BANKS } = require('../../constants/checkout');

const SESSION_TTL = 60 * 60 * 1000;
const sessions = new Map(); // sessionId -> { bank, orderNumber, amount, currency, returnUrls, status, createdAt }

const cleanup = () => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.createdAt > SESSION_TTL) sessions.delete(id);
};

const createSandboxProvider = (bankId) => ({
  id: bankId,
  mode: 'sandbox',

  createPayment: async ({ order, amount, currency, returnUrl, baseUrl }) => {
    cleanup();
    const sessionId = `sbx_${bankId.toLowerCase()}_${crypto.randomBytes(12).toString('hex')}`;
    sessions.set(sessionId, {
      bank: bankId,
      orderNumber: order.orderNumber,
      amount,
      currency,
      returnUrls: { success: returnUrl('success'), fail: returnUrl('fail'), cancel: returnUrl('cancel') },
      status: 'pending',
      createdAt: Date.now(),
    });
    return { sessionId, paymentUrl: `${baseUrl}/api/payments/sandbox/${sessionId}` };
  },

  getPaymentStatus: async (sessionId) => {
    const s = sessions.get(sessionId);
    if (!s) return { status: 'cancelled', message: 'სატესტო სესიას ვადა გაუვიდა' };
    if (s.status === 'paid') {
      return { status: 'paid', transactionId: `sbx_txn_${sessionId.slice(-10)}`, card: { brand: 'visa', last4: '4242' } };
    }
    if (s.status === 'failed') return { status: 'failed', message: 'ბანკმა გადახდა უარყო (სატესტო)' };
    if (s.status === 'cancelled') return { status: 'cancelled', message: 'გადახდა გაუქმდა' };
    return { status: 'pending' };
  },

  extractSessionId: (body) => body?.sessionId || null,

  // სესიის გაუქმება — გვერდზე დადასტურება შემდეგ აღარ იმუშავებს
  cancelPayment: async (sessionId) => {
    const s = sessions.get(sessionId);
    if (s && s.status === 'pending') s.status = 'cancelled';
  },
});

// სატესტო გვერდის მონაცემები და შედეგის დაფიქსირება (routes/paymentRoutes.js)
const getSandboxSession = (sessionId) => sessions.get(sessionId);

const completeSandboxSession = (sessionId, result) => {
  const s = sessions.get(sessionId);
  if (!s || s.status !== 'pending') return null;
  s.status = { approve: 'paid', decline: 'failed', cancel: 'cancelled' }[result] || 'cancelled';
  return s.returnUrls[{ paid: 'success', failed: 'fail', cancelled: 'cancel' }[s.status]];
};

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ნეიტრალური სატესტო გვერდი — ბანკის რეალურ ინტერფეისს არ იმეორებს
const renderSandboxPage = (sessionId, session) => {
  const bank = PAYMENT_BANKS[session.bank];
  const amount = Number(session.amount).toFixed(2);
  return `<!doctype html>
<html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>სატესტო გადახდა — ${esc(bank.latin)}</title>
<style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f3f5f7;color:#1b2733;display:grid;place-items:center;min-height:100vh;padding:20px}
  .box{width:100%;max-width:420px;background:#fff;border-radius:16px;box-shadow:0 10px 30px -10px rgba(0,0,0,.2);overflow:hidden}
  .ribbon{background:#fff4d6;color:#8a5a00;font-size:13px;font-weight:700;padding:10px 18px;text-align:center}
  .body{padding:24px}.bank{font-size:13px;color:#667;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  h1{font-size:20px;margin:6px 0 18px}.row{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid #eef0f2;font-size:14px}
  .row b{font-size:15px}.amount b{font-size:24px}.actions{display:flex;flex-direction:column;gap:10px;margin-top:22px}
  button{height:46px;border-radius:10px;border:1px solid #d5dbe1;background:#fff;font-size:15px;font-weight:700;cursor:pointer}
  button.ok{background:#1f8a52;border-color:#1f8a52;color:#fff}button.bad{color:#cf3434}
  p.note{font-size:12px;color:#778;margin:16px 0 0;line-height:1.5}
</style></head><body>
<div class="box">
  <div class="ribbon">სატესტო რეჟიმი — რეალური თანხა არ ჩამოიჭრება</div>
  <div class="body">
    <div class="bank">${esc(bank.latin)} · sandbox</div>
    <h1>გადახდის სიმულაცია</h1>
    <div class="row"><span>შეკვეთა</span><b>${esc(session.orderNumber)}</b></div>
    <div class="row amount"><span>თანხა</span><b>${esc(amount)} ${esc(session.currency)}</b></div>
    <form method="post" action="${esc(sessionId)}" class="actions">
      <button class="ok" name="result" value="approve">გადახდის დადასტურება</button>
      <button class="bad" name="result" value="decline">ბანკმა უარყო</button>
      <button name="result" value="cancel">გაუქმება</button>
    </form>
    <p class="note">ეს გვერდი ჩანს მხოლოდ მაშინ, როცა ${esc(bank.latin)}-ის credentials არ არის მითითებული. რეალურ რეჟიმში აქ ბანკის გადახდის გვერდი ჩაიტვირთება.</p>
  </div>
</div></body></html>`;
};

module.exports = { createSandboxProvider, getSandboxSession, completeSandboxSession, renderSandboxPage };
