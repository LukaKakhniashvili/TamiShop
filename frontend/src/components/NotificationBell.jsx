import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import NotificationItem from './NotificationItem';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/UIContext';

/** Header-ის ზარი: წაუკითხავების badge + ბოლო შეტყობინებების dropdown (მხოლოდ ავტორიზებულისთვის) */
const NotificationBell = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { unread, recent, recentStatus, loadRecent, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    loadRecent();
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('.notif-trigger')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loadRecent]);

  const onMarkAll = async () => {
    try {
      await markAllRead();
    } catch {
      toast({ type: 'error', title: t('notifications.actionFailed') });
    }
  };

  const label = unread > 0 ? `${t('notifications.bell')} — ${t('notifications.unreadCount', { count: unread })}` : t('notifications.bell');

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className="icon-btn notif-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={t('notifications.bell')}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span className="count" key={unread} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="dropdown notif-menu" role="dialog" aria-label={t('notifications.title')}>
          <div className="notif-menu-head">
            <strong>{t('notifications.title')}</strong>
            {unread > 0 && (
              <button type="button" className="link notif-mark-all" onClick={onMarkAll}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="notif-menu-list">
            {recentStatus === 'loading' && !recent.length ? (
              <div className="notif-menu-state">
                <span className="spinner" />
              </div>
            ) : recentStatus === 'error' && !recent.length ? (
              <div className="notif-menu-state">{t('notifications.loadFailed')}</div>
            ) : recent.length === 0 ? (
              <div className="notif-menu-state">
                <Icon name="bell" size={22} />
                <span>{t('notifications.emptyTitle')}</span>
              </div>
            ) : (
              recent.map((n) => <NotificationItem key={n._id} notification={n} compact onNavigate={() => setOpen(false)} />)
            )}
          </div>
          <Link to="/notifications" className="notif-menu-all" onClick={() => setOpen(false)}>
            {t('notifications.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
