import i18n, { currentLocale } from './index';
import { localizedField, formatDateTime } from './content';

/*
 * შეტყობინების ტექსტი მომხმარებლის მიმდინარე ენაზე.
 *   სისტემური (template + params) — თარგმანის გასაღებებიდან (ენის შეცვლისას ახლიდან ითარგმნება)
 *   ხელით შექმნილი — title/message + translations.{en,ru} (fallback ქართული), როგორც პროდუქტებში
 */
export const notificationText = (n, t = i18n.t.bind(i18n), lng = i18n.language) => {
  if (n.template === 'order_status' || n.template === 'order_received') {
    const title =
      n.template === 'order_received'
        ? t('notifications.templates.order_received.title')
        : t(`notifications.templates.order_status.${n.params?.status}`, { defaultValue: t('notifications.types.order') });
    return { title, message: t('notifications.templates.orderMessage', { orderNumber: n.params?.orderNumber || '' }) };
  }
  return { title: localizedField(n, 'title', lng) || '', message: localizedField(n, 'message', lng) || '' };
};

// მხოლოდ საიტის შიდა ბმული (იგივე წესი, რაც სერვერზე: backend/utils/internalLink.js)
const INTERNAL_LINK = /^\/(?![/\\])[A-Za-z0-9\-._~%!$&'()*+,;=:@/?#[\]]*$/;
export const safeInternalLink = (link) => (typeof link === 'string' && link.length <= 300 && INTERNAL_LINK.test(link) ? link : null);

/** „5 წუთის წინ" / „გუშინ" — Intl.RelativeTimeFormat (ენის მიხედვით); ერთ კვირაზე ძველი — თარიღი */
export const relativeTime = (value, t = i18n.t.bind(i18n)) => {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return t('notifications.justNow');
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDateTime(value);
};
