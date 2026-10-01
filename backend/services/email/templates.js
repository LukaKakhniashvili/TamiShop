const { BRAND, esc, renderLayout } = require('./layout');
const { PAYMENT_METHODS, PAYMENT_BANKS, DELIVERY_METHODS } = require('../../constants/checkout');

const money = (n) => `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾`;
const F = BRAND.font;

const ORDER_STATUS_LABELS = {
  pending: 'მიღებულია — მუშავდება',
  processing: 'მუშავდება',
  shipped: 'გაგზავნილია',
  completed: 'დასრულებულია',
  cancelled: 'გაუქმებულია',
};

const PAYMENT_STATUS_LABELS = {
  pay_on_delivery: 'გადასახდელია მიტანისას',
  paid: 'გადახდილია',
  pending: 'მოლოდინში',
};

const formatDate = (d) =>
  new Date(d).toLocaleString('ka-GE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tbilisi',
  });

// ---------------------------------------------------------------------------
// ვერიფიკაციის კოდი
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {string} p.code
 * @param {number} p.expiresInMinutes
 */
// ერთჯერადი კოდის წერილის საერთო შაბლონი (რეგისტრაცია, პაროლის აღდგენა).
// მკაცრად ტრანზაქციული: მოკლე ტექსტი, ბმულების/სურათების/დამალული ტექსტის გარეშე,
// კოდი თემაში არ იწერება; HTML და plain-text ვერსიები ერთსა და იმავე ინფორმაციას შეიცავს.
const codeEmail = ({ subject, title, heading, intro, instruction, code, expiresInMinutes, ignoreNote, footerNote }) => {
  const p = (text, margin = '0') => `<p style="margin:${margin};font:400 15px/1.65 ${F};color:${BRAND.text};">${esc(text)}</p>`;

  const body = `
    <tr><td class="px" style="padding:36px 40px 8px 40px;">
      <h1 class="h1" style="margin:0 0 12px 0;font:800 26px/1.25 ${F};color:${BRAND.ink};">${esc(heading)}</h1>
      ${p(intro, '0 0 10px 0')}
      ${p(instruction)}
    </td></tr>
    <tr><td class="px" align="center" style="padding:24px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td align="center" bgcolor="${BRAND.accentSoft}" style="background:${BRAND.accentSoft};border:1px solid ${BRAND.border};border-radius:14px;padding:22px 12px;">
          <div class="code" style="font:800 36px/1 'Courier New',Courier,monospace;letter-spacing:10px;color:${BRAND.ink};padding-left:10px;">${esc(code)}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td class="px" style="padding:0 40px 8px 40px;">
      ${p(`კოდი მოქმედებს ${expiresInMinutes} წუთის განმავლობაში.`)}
    </td></tr>
    <tr><td class="px" style="padding:16px 40px 36px 40px;">
      <p style="margin:0;padding-top:16px;border-top:1px solid ${BRAND.border};font:400 13px/1.6 ${F};color:${BRAND.muted};">
        ${esc(ignoreNote)} არავის გაუზიაროთ ეს კოდი.
      </p>
    </td></tr>`;

  const text = [
    heading,
    '',
    intro,
    instruction,
    '',
    `    ${code}`,
    '',
    `კოდი მოქმედებს ${expiresInMinutes} წუთის განმავლობაში.`,
    '',
    `${ignoreNote} არავის გაუზიაროთ ეს კოდი.`,
    '',
    '—',
    footerNote,
    `© ${new Date().getFullYear()} ${BRAND.name}`,
  ].join('\n');

  return { subject, html: renderLayout({ title, body, footerNote: esc(footerNote) }), text };
};

/** რეგისტრაციის ვერიფიკაციის კოდი */
const verificationEmail = ({ code, expiresInMinutes }) =>
  codeEmail({
    subject: `${BRAND.name} — ვერიფიკაციის კოდი`,
    title: 'ელ. ფოსტის ვერიფიკაცია',
    heading: 'დაადასტურეთ ელ. ფოსტა',
    intro: `გმადლობთ, რომ რეგისტრირდებით ${BRAND.name}-ზე.`,
    instruction: 'რეგისტრაციის დასასრულებლად გამოიყენეთ ვერიფიკაციის კოდი:',
    code,
    expiresInMinutes,
    ignoreNote: 'თუ ანგარიში თქვენ არ შეგიქმნიათ, უბრალოდ უგულებელყავით ეს წერილი.',
    footerNote: `ეს წერილი გამოგზავნილია, რადგან ამ მისამართით დაიწყო რეგისტრაცია ${BRAND.name}-ზე.`,
  });

/** პაროლის აღდგენის კოდი */
const passwordResetEmail = ({ code, expiresInMinutes }) =>
  codeEmail({
    subject: `${BRAND.name} — პაროლის აღდგენის კოდი`,
    title: 'პაროლის აღდგენა',
    heading: 'პაროლის აღდგენა',
    intro: `მივიღეთ მოთხოვნა თქვენი ${BRAND.name}-ის ანგარიშის პაროლის აღდგენაზე.`,
    instruction: 'გასაგრძელებლად გამოიყენეთ ეს კოდი:',
    code,
    expiresInMinutes,
    ignoreNote: 'თუ პაროლის აღდგენა თქვენ არ მოგითხოვიათ, უბრალოდ უგულებელყავით ეს წერილი — პაროლი არ შეიცვლება.',
    footerNote: `ეს წერილი გამოგზავნილია, რადგან ამ მისამართისთვის მოთხოვნილ იქნა პაროლის აღდგენა ${BRAND.name}-ზე.`,
  });

// ---------------------------------------------------------------------------
// შეკვეთის დადასტურება
// ---------------------------------------------------------------------------

const row = (label, value, { strong = false, color } = {}) => `
  <tr>
    <td width="44%" valign="top" style="padding:7px 12px 7px 0;font:400 14px/1.5 ${F};color:${BRAND.muted};">${label}</td>
    <td align="right" style="padding:7px 0;font:${strong ? 800 : 600} 14px/1.5 ${F};color:${color || BRAND.ink};">${value}</td>
  </tr>`;

const sectionTitle = (text) =>
  `<p style="margin:0 0 8px 0;font:800 13px ${F};letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.ink};">${text}</p>`;

/**
 * @param {object} p
 * @param {object} p.order    — Order დოკუმენტი (plain object)
 * @param {string} p.orderUrl — ბმული შეკვეთების გვერდზე
 */
const orderConfirmationEmail = ({ order, orderUrl }) => {
  const info = order.customerInfo || {};
  const address = info.address || {};
  const payment = order.payment || {};
  const delivery = order.delivery || {};
  const deliveryMethod = DELIVERY_METHODS[delivery.method];
  const isCod = payment.method === 'cod';

  const originalTotal = order.items.reduce((s, i) => s + (i.oldPrice || i.price) * i.quantity, 0);
  const itemsTotal = order.itemsTotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = Math.max(0, Math.round((originalTotal - itemsTotal) * 100) / 100);
  const paymentLabel =
    (PAYMENT_METHODS[payment.method]?.label || payment.method) +
    (payment.provider && PAYMENT_BANKS[payment.provider] ? ` · ${PAYMENT_BANKS[payment.provider].name}` : '');

  const itemRows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font:600 14px/1.45 ${F};color:${BRAND.ink};">
          ${esc(i.name)}
          <div style="font:400 13px ${F};color:${BRAND.muted};padding-top:3px;">
            ${i.quantity} × ${money(i.price)}${i.oldPrice ? ` <span style="text-decoration:line-through;">${money(i.oldPrice)}</span>` : ''}
          </div>
        </td>
        <td align="right" valign="top" style="padding:12px 0 12px 12px;border-bottom:1px solid ${BRAND.border};font:700 14px ${F};color:${BRAND.ink};white-space:nowrap;">
          ${money(i.price * i.quantity)}
        </td>
      </tr>`
    )
    .join('');

  const body = `
    <tr><td class="px" align="center" style="padding:34px 40px 10px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="56" height="56" align="center" valign="middle" bgcolor="${BRAND.successSoft}" style="width:56px;height:56px;background:${BRAND.successSoft};border-radius:28px;font:800 28px ${F};color:${BRAND.success};">✓</td>
      </tr></table>
      <h1 class="h1" style="margin:16px 0 8px 0;font:800 26px/1.25 ${F};color:${BRAND.ink};">შეკვეთა მიღებულია!</h1>
      <p style="margin:0;font:400 15px/1.65 ${F};color:${BRAND.text};">
        გმადლობთ, ${esc(info.firstName)}! თქვენი შეკვეთა წარმატებით გაფორმდა.
        ${isCod ? 'გადახდა მოხდება კურიერთან, შეკვეთის მიღებისას.' : ''}
      </p>
    </td></tr>

    <tr><td class="px" style="padding:22px 40px 6px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${BRAND.accentSoft}" style="background:${BRAND.accentSoft};border-radius:14px;padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td class="stack" style="font:400 12px ${F};color:${BRAND.muted};">
              შეკვეთის ნომერი
              <div style="font:800 22px/1.3 ${F};color:${BRAND.ink};letter-spacing:1px;">${esc(order.orderNumber)}</div>
              <div style="font:400 12px ${F};color:${BRAND.muted};padding-top:2px;">${esc(formatDate(order.createdAt))}</div>
            </td>
            <td class="stack" align="right" style="font:400 12px ${F};color:${BRAND.muted};">
              ${isCod ? 'გადასახდელი თანხა' : 'გადახდილი თანხა'}
              <div style="font:800 26px/1.3 ${F};color:${BRAND.accent};">${money(order.totalPrice)}</div>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr>

    <tr><td class="px" style="padding:24px 40px 0 40px;">
      ${sectionTitle('შეკვეთილი პროდუქტები')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        ${row(`ნივთები (${order.items.reduce((s, i) => s + i.quantity, 0)})`, money(originalTotal))}
        ${discount > 0 ? row('ფასდაკლება', `−${money(discount)}`, { color: BRAND.success }) : ''}
        ${row('მიწოდება', delivery.cost > 0 ? money(delivery.cost) : 'უფასო', { color: delivery.cost > 0 ? undefined : BRAND.success })}
        <tr><td colspan="2" style="padding-top:8px;border-top:2px solid ${BRAND.ink};font-size:0;line-height:0;">&nbsp;</td></tr>
        ${row('<span style="color:#1b1a17;font-weight:800;">სულ</span>', `<span style="font-size:18px;">${money(order.totalPrice)}</span>`, { strong: true, color: BRAND.accent })}
      </table>
    </td></tr>

    <tr><td class="px" style="padding:26px 40px 0 40px;">
      ${sectionTitle('მიწოდება')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('მიმღები', `${esc(info.firstName)} ${esc(info.lastName)}`)}
        ${row('ტელეფონი', esc(info.phone))}
        ${row('ქალაქი', esc(address.city))}
        ${row('მისამართი', esc(address.street) + (address.postalCode ? `, ${esc(address.postalCode)}` : ''))}
        ${row('მიწოდების მეთოდი', `${esc(deliveryMethod?.label || 'სტანდარტული მიწოდება')} — ${esc(delivery.estimate || deliveryMethod?.estimate || '')}`)}
        ${row('მიწოდების ღირებულება', delivery.cost > 0 ? money(delivery.cost) : 'უფასო')}
      </table>
    </td></tr>

    <tr><td class="px" style="padding:26px 40px 0 40px;">
      ${sectionTitle('გადახდა და სტატუსი')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('გადახდის მეთოდი', esc(paymentLabel))}
        ${row('გადახდის სტატუსი', esc(PAYMENT_STATUS_LABELS[payment.status] || payment.status))}
        ${row('შეკვეთის სტატუსი', esc(ORDER_STATUS_LABELS[order.status] || order.status))}
      </table>
    </td></tr>

    <tr><td class="px" align="center" style="padding:30px 40px 36px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${BRAND.accent}" style="background:${BRAND.accent};border-radius:12px;">
          <a href="${esc(orderUrl)}" style="display:inline-block;padding:14px 28px;font:700 15px ${F};color:#ffffff;text-decoration:none;">ჩემი შეკვეთების ნახვა</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0 0;font:400 13px/1.6 ${F};color:${BRAND.muted};">
        შეკვეთის სტატუსს ნებისმიერ დროს ნახავთ თქვენს პროფილში.
      </p>
    </td></tr>`;

  return {
    subject: `შეკვეთა ${order.orderNumber} მიღებულია — ${BRAND.name}`,
    html: renderLayout({
      title: `შეკვეთა ${order.orderNumber}`,
      preheader: `შეკვეთა ${order.orderNumber} · ${money(order.totalPrice)} · ${isCod ? 'გადახდა კურიერთან' : 'გადახდილია'}`,
      body,
      footerNote: `ეს წერილი გამოგზავნილია, რადგან ${esc(BRAND.name)}-ზე შეკვეთა გააფორმეთ.`,
    }),
  };
};

module.exports = { verificationEmail, passwordResetEmail, orderConfirmationEmail };
