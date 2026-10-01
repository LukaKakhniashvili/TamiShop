const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { BRAND_NAME } = require("../../constants/brand");

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

const useGmailApi = () => process.env.EMAIL_PROVIDER === "gmail_api";

/*
 * -------------------------------------------------------
 * SMTP — LOCAL
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
 * Gmail API — DEV / Render
 * -------------------------------------------------------
 */

let gmail = null;

const getGmailClient = () => {
  if (!gmail) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });
  }

  return gmail;
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
  const t = getTransporter();

  const info = await t.sendMail({
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
 * Gmail API sender
 * -------------------------------------------------------
 */

const sendWithGmailApi = async (message) => {
  // Nodemailer-ს მხოლოდ MIME წერილის სწორად ასაწყობად ვიყენებთ.
  // რეალური გაგზავნა SMTP-ით არ ხდება.
  const rawMessage = await new Promise((resolve, reject) => {
    const streamTransport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    });

    streamTransport.sendMail(
      {
        from: {
          name: BRAND_NAME,
          address: process.env.SMTP_USER,
        },

        ...(process.env.EMAIL_REPLY_TO
          ? { replyTo: process.env.EMAIL_REPLY_TO }
          : {}),

        ...message,
      },
      (error, info) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(info.message);
      },
    );
  });

  const raw = rawMessage
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmailClient = getGmailClient();

  const response = await gmailClient.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
    },
  });

  return {
    sent: true,
    messageId: response.data.id,
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

    if (useGmailApi()) {
      result = await sendWithGmailApi(message);
    } else {
      result = await sendWithSmtp(message);
    }

    console.log(
      `[email] provider=${useGmailApi() ? "gmail_api" : "smtp"} ` +
        `type=${type} ` +
        `to=${recipientDomain(to)} ` +
        `result=sent ` +
        `messageId=${result.messageId || "-"}`,
    );

    return result;
  } catch (error) {
    console.error(
      `[email] provider=${useGmailApi() ? "gmail_api" : "smtp"} ` +
        `type=${type} ` +
        `to=${recipientDomain(to)} ` +
        `result=failed ` +
        `code=${error.code || "-"} ` +
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
