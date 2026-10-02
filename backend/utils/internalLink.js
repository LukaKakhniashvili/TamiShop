/*
 * შეტყობინების ბმული — მხოლოდ საიტის შიდა გზა („/products?sale=1", „/profile?tab=orders&order=...").
 * გარე მისამართები, protocol-relative („//evil.com"), javascript: და მსგავსი — უარყოფილია.
 */
const INTERNAL_LINK = /^\/(?![/\\])[A-Za-z0-9\-._~%!$&'()*+,;=:@/?#[\]]*$/;
const MAX_LINK_LENGTH = 300;

const isInternalLink = (value) => typeof value === 'string' && value.length <= MAX_LINK_LENGTH && INTERNAL_LINK.test(value);

module.exports = { isInternalLink, MAX_LINK_LENGTH };
