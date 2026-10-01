const nodemailer = require("nodemailer");
const dns = require("dns");
const { BRAND_NAME } = require("../../constants/brand");

// Render-ზე Gmail SMTP-სთან დაკავშირებისას უპირატესობა მიენიჭოს IPv4-ს.
// ეს თავიდან გვაცილებს IPv6-ზე ENETUNREACH შეცდომას.
dns.setDefaultResultOrder("ipv4first");

/*
 * ერთადერთი ელ. ფოსტის სერვისი — ყველა წერილი (ვერიფიკაცია, შეკვეთის დადასტურება ...) იგზავნება
 * ერთი transporter-ით და ერთი გამგზავნით. განსხვავდება მხოლოდ თემა და შაბლონი (templates.js).
 *
 * გამგზავნი: "Tam`i Shop" <SMTP_USER> — მისამართი არასდროს იქმნება დინამიკურად. Gmail SMTP-ის
 * შემთხვევაში From უნდა იყოს იგივე ანგარიში, რომლითაც ავტორიზაცია ხდება (წინააღმდეგ შემთხვევაში
 * Gmail გადაწერს From-ს და DMARC-ის შესაბამისობა ირღვევა).
 */

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

// ტექსტური ვერსია HTML-დან — გამოიყენება, თუ შაბლონი საკუთარ text-ს არ აწვდის
const htmlToText = (html) =>
  decodeEntities(
    html
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div[^>]*display:none[\s\S]*?<\/div>/gi, "")
      .replace(/<(br|\/p|\/tr|\/h\d|\/div)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

// ლოგში მხოლოდ მიმღების დომენი — სრული მისამართი პერსონალური მონაცემია
const recipientDomain = (to) => `*@${String(to).split("@")[1] || "?"}`;

const isLogOnly = () =>
  process.env.EMAIL_DELIVERY === "log" ||
  !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;

const getTransporter = () => {
  if (isLogOnly()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",

      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },

      connectionTimeout: 10000,
      socketTimeout: 15000,

      // SMTP hostname მხოლოდ IPv4 მისამართად resolve-დეს.
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { family: 4 }, callback);
      },
    });
  }

  return transporter;
};

/** გამგზავნის იდენტობა — ყველა წერილისთვის ერთი და იგივე */
const senderIdentity = () => ({
  from: {
    name: BRAND_NAME,
    address: process.env.SMTP_USER,
  },

  // არასავალდებულო: პასუხები სხვა (მაგ. support@) მისამართზე
  ...(process.env.EMAIL_REPLY_TO
    ? { replyTo: process.env.EMAIL_REPLY_TO }
    : {}),
});

/**
 * ელ. წერილის გაგზავნა.
 * შეცდომას არ აგდებს — აბრუნებს:
 * { sent, mock?, messageId?, error? }
 *
 * თითოეულ გაგზავნაზე ერთი მცდელობა
 * (ავტომატური განმეორება არ ხდება).
 *
 * @param {object} p
 * @param {string} p.type
 * @param {string} p.to
 * @param {string} p.subject
 * @param {string} p.html
 * @param {string} [p.text]
 */

/**
 * საბოლოო წერილი (nodemailer-ის ფორმატით) —
 * ყველა ტიპისთვის ერთნაირი ჰედერები და multipart/alternative
 */
const buildMessage = ({ to, subject, html, text }) => ({
  ...senderIdentity(),
  to,
  subject,
  text: text || htmlToText(html),
  html,
});

const sendEmail = async ({ type = "generic", ...content }) => {
  const message = buildMessage(content);
  const { to } = message;

  const t = getTransporter();

  if (!t) {
    // SMTP-ის გარეშე (development / EMAIL_DELIVERY=log)
    // კონსოლი არის „მიწოდების არხი" — სრული ტექსტი იბეჭდება
    console.log(
      `\n======================================\n` +
        `[MOCK EMAIL] type=${type}\n` +
        `To: ${to}\n` +
        `Subject: ${message.subject}\n\n` +
        `${message.text}\n` +
        `======================================\n`,
    );

    return {
      sent: false,
      mock: true,
    };
  }

  try {
    const info = await t.sendMail(message);

    console.log(
      `[email] type=${type} ` +
        `to=${recipientDomain(to)} ` +
        `result=sent ` +
        `messageId=${info.messageId} ` +
        `response="${String(info.response || "").slice(0, 120)}"`,
    );

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(
      `[email] type=${type} ` +
        `to=${recipientDomain(to)} ` +
        `result=failed ` +
        `code=${error.code || "-"} ` +
        `responseCode=${error.responseCode || "-"} ` +
        `error="${error.message}"`,
    );

    return {
      sent: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendEmail,
  buildMessage,
  htmlToText,
};
