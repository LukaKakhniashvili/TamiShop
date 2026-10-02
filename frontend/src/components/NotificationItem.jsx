import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useNotifications } from '../context/NotificationContext';
import { notificationText, relativeTime, safeInternalLink } from '../i18n/notifications';

const TYPE_ICON = { order: 'receipt', marketing: 'sparkle', promotion: 'tag', system: 'info' };

/**
 * ერთი შეტყობინება (dropdown და სრული გვერდი). დაჭერა: წაკითხულად მონიშვნა → შიდა ბმულზე გადასვლა.
 * გარე / არავალიდური ბმული ნავიგაციისთვის არ გამოიყენება.
 */
const NotificationItem = ({ notification: n, compact = false, onNavigate, onRead }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { markRead } = useNotifications();
  const { title, message } = notificationText(n, t, i18n.language);
  const link = safeInternalLink(n.link);

  const open = async () => {
    if (!n.read) {
      onRead?.(n._id);
      markRead(n._id);
    }
    if (link) {
      onNavigate?.();
      navigate(link);
    }
  };

  return (
    <button type="button" className={`notif-item ${n.read ? 'is-read' : 'is-unread'} ${compact ? 'compact' : ''}`} onClick={open}>
      <span className={`notif-icon type-${n.type}`} aria-hidden="true">
        <Icon name={n.template === 'review_reminder' ? 'star' : TYPE_ICON[n.type] || 'info'} size={compact ? 16 : 18} />
      </span>
      <span className="notif-body">
        <span className="notif-title">
          {!n.read && <span className="notif-dot" aria-hidden="true" />}
          {title}
        </span>
        {message && <span className="notif-message">{message}</span>}
        <span className="notif-meta">
          <span>{t(`notifications.types.${n.type}`, { defaultValue: '' })}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={n.createdAt}>{relativeTime(n.createdAt, t)}</time>
          {!n.read && <span className="sr-only">· {t('notifications.unread')}</span>}
        </span>
      </span>
      {link && <Icon name="chevronRight" size={16} className="notif-go" />}
    </button>
  );
};

export default NotificationItem;
