const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const { BRAND_NAME } = require("../../constants/brand");

/*
 * Email delivery:
 *
 * LOCAL / SMTP:
 *   Gmail SMTP → Nodemailer
 *
 * DEV / Render:
 *   Resend HTTPS API
 *
 * EMAIL_PROVIDER=resend შემთხვევაში გამოიყენება Resend.
 * სხვა შემთხვევაში რჩება არსებული SMTP გაგზავნა.
 */

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

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

const recipientDomain = (to) => `*@${String(to).split("@")[1] || "?"}`;

const useResend = () => process.env.EMAIL_PROVIDER === "resend";

/*
 * -------------------------------------------------------
 * SMTP / Nodemailer
 * -------------------------------------------------------
 */

let transporter = null;

const getTransporter = () => {
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
    });
  }

  return transporter;
};

/*
 * -------------------------------------------------------
 * Resend
 * -------------------------------------------------------
 */

let resend = null;

const getResend = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  return resend;
};

/*
 * -------------------------------------------------------
 * Message
 * -------------------------------------------------------
 */

const buildMessage = ({ to, subject, html, text }) => ({
  to,
  subject,
  text: text || htmlToText(html),
  html,
});

/*
 * -------------------------------------------------------
 * SMTP sender
 * -------------------------------------------------------
 */

const sendWithSmtp = async (message) => {
  const transporter = getTransporter();

  const info = await transporter.sendMail({
    from: {
      name: BRAND_NAME,
      address: process.env.SMTP_USER,
    },

    ...(process.env.EMAIL_REPLY_TO
      ? { replyTo: process.env.EMAIL_REPLY_TO }
      : {}),

    ...message,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
};

/*
 * -------------------------------------------------------
 * Resend sender
 * -------------------------------------------------------
 */

const sendWithResend = async (message) => {
  const client = getResend();

  const { data, error } = await client.emails.send({
    from: `${BRAND_NAME} <onboarding@resend.dev>`,

    to: [message.to],

    subject: message.subject,

    html: message.html,

    text: message.text,

    ...(process.env.EMAIL_REPLY_TO
      ? { replyTo: process.env.EMAIL_REPLY_TO }
      : {}),
  });

  if (error) {
    throw new Error(error.message || "Resend email delivery failed");
  }

  return {
    sent: true,
    messageId: data?.id,
  };
};

/*
 * -------------------------------------------------------
 * Public sender
 * -------------------------------------------------------
 */

const sendEmail = async ({ type = "generic", ...content }) => {
  const message = buildMessage(content);
  const { to } = message;

  try {
    let result;

    if (useResend()) {
      result = await sendWithResend(message);
    } else {
      result = await sendWithSmtp(message);
    }

    console.log(
      `[email] provider=${useResend() ? "resend" : "smtp"} ` +
        `type=${type} ` +
        `to=${recipientDomain(to)} ` +
        `result=sent ` +
        `messageId=${result.messageId || "-"}`,
    );

    return result;
  } catch (error) {
    console.error(
      `[email] provider=${useResend() ? "resend" : "smtp"} ` +
        `type=${type} ` +
        `to=${recipientDomain(to)} ` +
        `result=failed ` +
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
