import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Icon from '../components/Icon';
import NotificationItem from '../components/NotificationItem';
import { EmptyState } from '../components/ui';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/UIContext';
import useDocumentMeta from '../hooks/useDocumentMeta';

const PAGE_SIZE = 15;

/** სრული Notification Center — გვერდებად („მეტის ჩვენება"), წაკითხვის სტატუსით */
const Notifications = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { unread, setUnread, markAllRead } = useNotifications();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  useDocumentMeta(t('notifications.metaTitle'));

  const load = useCallback(
    async (p) => {
      const { data } = await api.get('/notification-list', { params: { page: p, limit: PAGE_SIZE } });
      setItems((prev) => (p === 1 ? data.notifications : [...prev, ...data.notifications.filter((n) => !prev.some((x) => x._id === n._id))]));
      setPage(data.page);
      setPages(data.pages);
      setUnread(data.unread);
    },
    [setUnread]
  );

  useEffect(() => {
    setStatus('loading');
    load(1)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'));
  }, [load]);

  const more = async () => {
    setLoadingMore(true);
    try {
      await load(page + 1);
    } catch {
      toast({ type: 'error', title: t('notifications.loadFailed') });
    } finally {
      setLoadingMore(false);
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllRead();
      setItems((list) => list.map((n) => ({ ...n, read: true })));
      toast({ title: t('notifications.allRead') });
    } catch {
      toast({ type: 'error', title: t('notifications.actionFailed') });
    }
  };

  const onRead = (id) => setItems((list) => list.map((n) => (n._id === id ? { ...n, read: true } : n)));

  return (
    <div className="container page notif-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('notifications.title')}</h1>
          <p className="page-subtitle">{unread > 0 ? t('notifications.unreadCount', { count: unread }) : t('notifications.subtitle')}</p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn-sm" onClick={onMarkAll}>
            <Icon name="check" size={16} /> {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {status === 'loading' ? (
        <div className="card notif-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 72, margin: 8, borderRadius: 12 }} />
          ))}
        </div>
      ) : status === 'error' ? (
        <div className="card">
          <EmptyState icon="alert" title={t('notifications.loadFailed')} text={t('catalog.loadErrorText')}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={16} /> {t('common.retry')}
            </button>
          </EmptyState>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="bell" title={t('notifications.emptyTitle')} text={t('notifications.emptyText')}>
            <Link to="/products" className="btn btn-primary">
              {t('cart.continueShopping')} <Icon name="arrowRight" size={16} />
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="card notif-list">
            {items.map((n) => (
              <NotificationItem key={n._id} notification={n} onRead={onRead} />
            ))}
          </div>
          {page < pages && (
            <div className="notif-more">
              <button type="button" className="btn" onClick={more} disabled={loadingMore}>
                {loadingMore ? <span className="spinner" /> : <Icon name="chevronDown" size={16} />} {t('notifications.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;
