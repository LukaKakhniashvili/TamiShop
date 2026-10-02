const { BRAND, esc, renderLayout } = require('./layout');
const { emailMessages } = require('./messages');
const { DELIVERY_METHODS, GEORGIAN_CITIES } = require('../../constants/checkout');

/*
 * წერილების შაბლონები — ერთი შაბლონი ყველა ენისთვის; ტექსტები messages.js-დან (lng: ka | en | ru, fallback ka).
 */

const money = (n) => `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾`;
const F = BRAND.font;

const formatDate = (d, locale) =>
  new Date(d).toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tbilisi',
  });

// ქალაქი: ქართულად — ქართული სახელი, სხვა ენაზე — ლათინური (შეკვეთაში ყოველთვის ქართული ინახება)
const cityName = (city, lng) => (lng === 'ka' ? city : GEORGIAN_CITIES.find((c) => c.name === city)?.latin || city);

// დინამიკური ტექსტი არჩეულ ენაზე (შეკვეთის snapshot-ის translations), fallback — ქართული
const localized = (entity, field, lng) => (lng !== 'ka' && entity?.translations?.[lng]?.[field]) || entity?.[field] || '';

// ---------------------------------------------------------------------------
// ერთჯერადი კოდის წერილი (რეგისტრაცია, პაროლის აღდგენა).
// მკაცრად ტრანზაქციული: მოკლე ტექსტი, ბმულების/სურათების/დამალული ტექსტის გარეშე,
// კოდი თემაში არ იწერება; HTML და plain-text ვერსიები ერთსა და იმავე ინფორმაციას შეიცავს.
// ---------------------------------------------------------------------------
const codeEmail = ({ m, texts, code, expiresInMinutes }) => {
  const { subject, title, heading, intro, instruction, ignoreNote, footerNote } = texts;
  const p = (text, margin = '0') => `<p style="margin:${margin};font:400 15px/1.65 ${F};color:${BRAND.text};">${esc(text)}</p>`;
  const validity = m.codeValid(expiresInMinutes);

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
      ${p(validity)}
    </td></tr>
    <tr><td class="px" style="padding:16px 40px 36px 40px;">
      <p style="margin:0;padding-top:16px;border-top:1px solid ${BRAND.border};font:400 13px/1.6 ${F};color:${BRAND.muted};">
        ${esc(ignoreNote)} ${esc(m.dontShare)}
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
    validity,
    '',
    `${ignoreNote} ${m.dontShare}`,
    '',
    '—',
    footerNote,
    `© ${new Date().getFullYear()} ${BRAND.name}`,
  ].join('\n');

  return { subject, html: renderLayout({ title, body, footerNote: esc(footerNote), lang: m.htmlLang, rights: m.rights }), text };
};

/** რეგისტრაციის ვერიფიკაციის კოდი */
const verificationEmail = ({ code, expiresInMinutes, lng }) => {
  const m = emailMessages(lng);
  return codeEmail({ m, texts: m.verification, code, expiresInMinutes });
};

/** პაროლის აღდგენის კოდი */
const passwordResetEmail = ({ code, expiresInMinutes, lng }) => {
  const m = emailMessages(lng);
  return codeEmail({ m, texts: m.reset, code, expiresInMinutes });
};

// ---------------------------------------------------------------------------
// შეკვეთის დადასტურება
// ---------------------------------------------------------------------------

const row = (label, value, { strong = false, color } = {}) => `
  <tr>
    <td width="44%" valign="top" style="padding:7px 12px 7px 0;font:400 14px/1.5 ${F};color:${BRAND.muted};">${label}</td>
    <td align="right" style="padding:7px 0;font:${strong ? 800 : 600} 14px/1.5 ${F};color:${color || BRAND.ink};">${value}</td>
  </tr>`;

const sectionTitle = (text) =>
  `<p style="margin:0 0 8px 0;font:800 13px ${F};letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.ink};">${esc(text)}</p>`;

/**
 * @param {object} p
 * @param {object} p.order    — Order დოკუმენტი (plain object)
 * @param {string} p.orderUrl — ბმული შეკვეთების გვერდზე
 * @param {string} [p.lng]    — წერილის ენა (ნაგულისხმევად order.language → ka)
 */
const orderConfirmationEmail = ({ order, orderUrl, lng = order.language }) => {
  const m = emailMessages(lng);
  const lang = m.htmlLang;
  const t = m.order;
  const info = order.customerInfo || {};
  const address = info.address || {};
  const payment = order.payment || {};
  const delivery = order.delivery || {};
  const deliveryMethod = DELIVERY_METHODS[delivery.method] || DELIVERY_METHODS.standard;
  const isCod = payment.method === 'cod';

  const originalTotal = order.items.reduce((s, i) => s + (i.oldPrice || i.price) * i.quantity, 0);
  const itemsTotal = order.itemsTotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = Math.max(0, Math.round((originalTotal - itemsTotal) * 100) / 100);
  const paymentLabel =
    (t.paymentMethods[payment.method] || payment.method) + (payment.provider && t.banks[payment.provider] ? ` · ${t.banks[payment.provider]}` : '');
  const estimate = deliveryMethod ? t.estimate(deliveryMethod.minDays, deliveryMethod.maxDays) : delivery.estimate || '';

  const itemRows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font:600 14px/1.45 ${F};color:${BRAND.ink};">
          ${esc(localized(i, 'name', lang))}
          ${
            i.variant?.options?.length
              ? `<div style="font:400 13px ${F};color:${BRAND.text};padding-top:3px;">${i.variant.options
                  .map((o) => `${esc(localized(o, 'name', lang))}: ${esc(localized(o, 'value', lang))}`)
                  .join(' · ')}</div>`
              : ''
          }
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
      <h1 class="h1" style="margin:16px 0 8px 0;font:800 26px/1.25 ${F};color:${BRAND.ink};">${esc(t.heading)}</h1>
      <p style="margin:0;font:400 15px/1.65 ${F};color:${BRAND.text};">
        ${esc(t.thanks(info.firstName))}
        ${isCod ? esc(t.codNote) : ''}
      </p>
    </td></tr>

    <tr><td class="px" style="padding:22px 40px 6px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${BRAND.accentSoft}" style="background:${BRAND.accentSoft};border-radius:14px;padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td class="stack" style="font:400 12px ${F};color:${BRAND.muted};">
              ${esc(t.orderNumber)}
              <div style="font:800 22px/1.3 ${F};color:${BRAND.ink};letter-spacing:1px;">${esc(order.orderNumber)}</div>
              <div style="font:400 12px ${F};color:${BRAND.muted};padding-top:2px;">${esc(formatDate(order.createdAt, m.locale))}</div>
            </td>
            <td class="stack" align="right" style="font:400 12px ${F};color:${BRAND.muted};">
              ${esc(isCod ? t.amountDue : t.amountPaid)}
              <div style="font:800 26px/1.3 ${F};color:${BRAND.accent};">${money(order.totalPrice)}</div>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr>

    <tr><td class="px" style="padding:24px 40px 0 40px;">
      ${sectionTitle(t.items)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        ${row(esc(t.itemsCount(order.items.reduce((s, i) => s + i.quantity, 0))), money(originalTotal))}
        ${discount > 0 ? row(esc(t.discount), `−${money(discount)}`, { color: BRAND.success }) : ''}
        ${row(esc(t.delivery), delivery.cost > 0 ? money(delivery.cost) : esc(t.free), { color: delivery.cost > 0 ? undefined : BRAND.success })}
        <tr><td colspan="2" style="padding-top:8px;border-top:2px solid ${BRAND.ink};font-size:0;line-height:0;">&nbsp;</td></tr>
        ${row(`<span style="color:#1b1a17;font-weight:800;">${esc(t.total)}</span>`, `<span style="font-size:18px;">${money(order.totalPrice)}</span>`, { strong: true, color: BRAND.accent })}
      </table>
    </td></tr>

    <tr><td class="px" style="padding:26px 40px 0 40px;">
      ${sectionTitle(t.delivery)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row(esc(t.recipient), `${esc(info.firstName)} ${esc(info.lastName)}`)}
        ${row(esc(t.phone), esc(info.phone))}
        ${row(esc(t.city), esc(cityName(address.city, lang)))}
        ${row(esc(t.address), esc(address.street) + (address.postalCode ? `, ${esc(address.postalCode)}` : ''))}
        ${row(esc(t.deliveryMethod), `${esc(t.standardDelivery)} — ${esc(estimate)}`)}
        ${row(esc(t.deliveryCost), delivery.cost > 0 ? money(delivery.cost) : esc(t.free))}
      </table>
    </td></tr>

    <tr><td class="px" style="padding:26px 40px 0 40px;">
      ${sectionTitle(t.paymentAndStatus)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row(esc(t.paymentMethod), esc(paymentLabel))}
        ${row(esc(t.paymentStatus), esc(t.paymentStatuses[payment.status] || payment.status))}
        ${row(esc(t.orderStatus), esc(t.orderStatuses[order.status] || order.status))}
      </table>
    </td></tr>

    <tr><td class="px" align="center" style="padding:30px 40px 36px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${BRAND.accent}" style="background:${BRAND.accent};border-radius:12px;">
          <a href="${esc(orderUrl)}" style="display:inline-block;padding:14px 28px;font:700 15px ${F};color:#ffffff;text-decoration:none;">${esc(t.viewOrders)}</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0 0;font:400 13px/1.6 ${F};color:${BRAND.muted};">
        ${esc(t.statusHint)}
      </p>
    </td></tr>`;

  return {
    subject: t.subject(order.orderNumber),
    html: renderLayout({
      title: t.title(order.orderNumber),
      preheader: `${t.title(order.orderNumber)} · ${money(order.totalPrice)} · ${isCod ? t.preheaderCod : t.preheaderPaid}`,
      body,
      footerNote: esc(t.footerNote),
      lang,
      rights: m.rights,
    }),
  };
};

// ---------------------------------------------------------------------------
// შეკვეთის სტატუსის ცვლილება (processing / shipped / completed / cancelled)
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {object} p.order    — Order (plain object)
 * @param {string} p.status   — ახალი სტატუსი
 * @param {string} p.orderUrl — ბმული შეკვეთაზე (My Orders)
 * @param {string} [p.lng]    — ენა (ნაგულისხმევად order.language → ka)
 */
const orderStatusEmail = ({ order, status, orderUrl, lng = order.language }) => {
  const m = emailMessages(lng);
  const t = m.orderStatus;
  const label = m.order.orderStatuses[status] || status;
  const heading = t.heading[status] || label;
  const text = (t.text[status] || (() => ''))(order.orderNumber);
  const isCancelled = status === 'cancelled';

  const body = `
    <tr><td class="px" style="padding:34px 40px 8px 40px;">
      <h1 class="h1" style="margin:0 0 12px 0;font:800 26px/1.25 ${F};color:${BRAND.ink};">${esc(heading)}</h1>
      <p style="margin:0;font:400 15px/1.65 ${F};color:${BRAND.text};">${esc(text)}</p>
    </td></tr>
    <tr><td class="px" style="padding:20px 40px 0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row(esc(m.order.orderNumber), esc(order.orderNumber))}
        ${row(esc(m.order.orderStatus), esc(label), { color: isCancelled ? '#b42318' : BRAND.success })}
        ${row(esc(m.order.total), money(order.totalPrice), { strong: true })}
      </table>
    </td></tr>
    <tr><td class="px" align="center" style="padding:28px 40px 36px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td bgcolor="${BRAND.accent}" style="background:${BRAND.accent};border-radius:12px;">
          <a href="${esc(orderUrl)}" style="display:inline-block;padding:14px 28px;font:700 15px ${F};color:#ffffff;text-decoration:none;">${esc(m.order.viewOrders)}</a>
        </td>
      </tr></table>
    </td></tr>`;

  return {
    subject: t.subject(order.orderNumber, label),
    html: renderLayout({ title: heading, preheader: text, body, footerNote: esc(t.footerNote), lang: m.htmlLang, rights: m.rights }),
  };
};

module.exports = { verificationEmail, passwordResetEmail, orderConfirmationEmail, orderStatusEmail };
