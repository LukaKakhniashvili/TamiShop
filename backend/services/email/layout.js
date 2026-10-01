/*
 * ელ. წერილების საერთო განლაგება — საიტის ბრენდინგით.
 *
 * ელ. ფოსტის კლიენტებთან თავსებადობისთვის: ცხრილებზე დაფუძნებული განლაგება, inline სტილები,
 * ყველა ფონი და ტექსტის ფერი ცალსახად მითითებულია (bgcolor + style) — ასე Gmail/Outlook-ის
 * ავტომატური მუქი რეჟიმი წერილს ვერ ხდის წაუკითხავს. SVG და ვებ-შრიფტები არ გამოიყენება.
 */

const { BRAND_NAME, BRAND_PARTS } = require('../../constants/brand');

const BRAND = {
  name: BRAND_NAME,
  accent: '#c2410c',
  accentSoft: '#fdf0ea',
  ink: '#1b1a17',
  text: '#3d3a34',
  muted: '#7a756c',
  border: '#e7e3dc',
  page: '#f4f2ee',
  card: '#ffffff',
  success: '#157046',
  successSoft: '#e5f4ec',
  font: "'Noto Sans Georgian','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
};

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const year = () => new Date().getFullYear();

/**
 * @param {object} p
 * @param {string} p.title      — <title> და preheader-ის სათაური
 * @param {string} [p.preheader] — inbox-ში ნაჩვენები მოკლე ტექსტი (არასავალდებულო)
 * @param {string} p.body       — წერილის შიგთავსი (HTML, ცხრილის რიგები)
 * @param {string} p.footerNote — ფუტერის ახსნა-განმარტება
 * @param {string} [p.lang]     — html lang (ka/en/ru)
 * @param {string} [p.rights]   — „ყველა უფლება დაცულია" წერილის ენაზე
 */
const renderLayout = ({ title, preheader, body, footerNote, lang = 'ka', rights = 'ყველა უფლება დაცულია.' }) => `<!doctype html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(title)}</title>
<style>
  body{margin:0;padding:0;background:${BRAND.page};}
  table{border-collapse:collapse;}
  img{border:0;display:block;}
  @media (max-width:600px){
    .container{width:100% !important;}
    .px{padding-left:20px !important;padding-right:20px !important;}
    .stack{display:block !important;width:100% !important;}
    .h1{font-size:22px !important;}
    .code{font-size:34px !important;letter-spacing:10px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};" bgcolor="${BRAND.page}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.page};">${esc(preheader)}</div>\n` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BRAND.page}" style="background:${BRAND.page};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;">
    <!-- brand -->
    <tr><td style="padding:0 4px 18px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="36" height="36" align="center" valign="middle" bgcolor="${BRAND.accent}" style="width:36px;height:36px;background:${BRAND.accent};border-radius:10px;color:#ffffff;font:800 18px ${BRAND.font};">T</td>
        <td style="padding-left:10px;font:800 21px ${BRAND.font};color:${BRAND.ink};letter-spacing:-0.5px;">${esc(BRAND_PARTS.main)} <span style="color:${BRAND.accent};">${esc(BRAND_PARTS.accent)}</span></td>
      </tr></table>
    </td></tr>
    <!-- card -->
    <tr><td bgcolor="${BRAND.card}" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td height="6" bgcolor="${BRAND.accent}" style="height:6px;line-height:6px;font-size:0;background:${BRAND.accent};border-radius:18px 18px 0 0;">&nbsp;</td></tr>
        ${body}
      </table>
    </td></tr>
    <!-- footer -->
    <tr><td align="center" style="padding:22px 16px 0 16px;font:400 12px/1.6 ${BRAND.font};color:${BRAND.muted};">
      ${footerNote ? `${footerNote}<br>` : ''}© ${year()} ${esc(BRAND.name)}. ${esc(rights)}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

module.exports = { BRAND, esc, renderLayout };
