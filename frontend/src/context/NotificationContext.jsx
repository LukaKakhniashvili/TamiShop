import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from './AuthContext';

/*
 * Notification Center — საერთო მდგომარეობა (header-ის badge, dropdown, სრული გვერდი).
 *   unread  — მხოლოდ რაოდენობის მსუბუქი მოთხოვნით (notification-unread-count), სიის ჩატვირთვის გარეშე
 *   recent  — ბოლო რამდენიმე (dropdown-ის გახსნისას)
 * განახლება: შესვლისას, გვერდის გადასვლისას და ფანჯრის ფოკუსზე — არაუმეტეს ერთხელ წუთში (polling-ის გარეშე).
 * გასვლისას მდგომარეობა მაშინვე სუფთავდება.
 */

const NotificationContext = createContext(null);
const REFRESH_MIN_GAP = 60 * 1000;
const RECENT_LIMIT = 6;

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState([]);
  const [recentStatus, setRecentStatus] = useState('idle'); // idle | loading | ready | error
  const lastRefresh = useRef(0);
  const userId = user?._id || user?.id;

  const refreshUnread = useCallback(
    async (force = false) => {
      if (!userId) return;
      if (!force && Date.now() - lastRefresh.current < REFRESH_MIN_GAP) return;
      lastRefresh.current = Date.now();
      try {
        const { data } = await api.get('/notification-unread-count');
        setUnread(data.unread);
      } catch {
        /* badge — არაკრიტიკული; შემდეგ განახლებაზე ისევ ვცდით */
      }
    },
    [userId]
  );

  const loadRecent = useCallback(async () => {
    if (!userId) return;
    setRecentStatus((s) => (s === 'ready' ? s : 'loading'));
    try {
      const { data } = await api.get('/notification-list', { params: { limit: RECENT_LIMIT } });
      setRecent(data.notifications);
      setUnread(data.unread);
      lastRefresh.current = Date.now();
      setRecentStatus('ready');
    } catch {
      setRecentStatus('error');
    }
  }, [userId]);

  // მომხმარებლის შეცვლა: გასვლა → გასუფთავება; შესვლა → ახლიდან
  useEffect(() => {
    setUnread(0);
    setRecent([]);
    setRecentStatus('idle');
    lastRefresh.current = 0;
    if (userId) refreshUnread(true);
  }, [userId, refreshUnread]);

  useEffect(() => {
    refreshUnread();
  }, [location.pathname, refreshUnread]);

  useEffect(() => {
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshUnread]);

  /** წაკითხულად მონიშვნა — UI მაშინვე, სერვერის პასუხით სინქრონიზაცია */
  const markRead = useCallback(async (id) => {
    let wasUnread = false;
    setRecent((list) =>
      list.map((n) => {
        if (n._id !== id) return n;
        wasUnread = !n.read;
        return { ...n, read: true };
      })
    );
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    try {
      const { data } = await api.put(`/notification-read/${id}`);
      setUnread(data.unread);
      return data.notification;
    } catch (err) {
      return null;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const { data } = await api.put('/notification-read-all');
    setUnread(data.unread);
    setRecent((list) => list.map((n) => ({ ...n, read: true })));
    return data;
  }, []);

  const value = { unread, setUnread, recent, recentStatus, loadRecent, refreshUnread, markRead, markAllRead, enabled: Boolean(userId) };
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);
