import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import i18n from '../i18n';
import { apiErrorMessage } from '../i18n/errors';
import { useAuth } from './AuthContext';
import { useToast } from './UIContext';

/*
 * რჩეულები — საერთო მდგომარეობა (ProductCard, ProductDetail, Header, Profile).
 *   ids იტვირთება ერთხელ (შესვლისას) — ბარათები საკუთარ მოთხოვნას არ აგზავნიან.
 *   toggle — optimistic: UI მაშინვე, სერვერის პასუხით სინქრონიზაცია, შეცდომისას — დაბრუნება + toast.
 *   ერთი პროდუქტის ორმაგი დაჭერა მიმდინარე მოთხოვნისას იგნორირდება.
 *   სტუმარი: შესვლის გვერდზე გადადის; სასურველი პროდუქტი შესვლის შემდეგ ავტომატურად ემატება.
 *   გასვლისას სია მაშინვე სუფთავდება.
 */

const WishlistContext = createContext(null);
const PENDING_KEY = 'wishlist:pending';

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?._id || user?.id;
  const [ids, setIds] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const busy = useRef(new Set());
  const [busyIds, setBusyIds] = useState([]);

  const setBusy = (id, on) => {
    if (on) busy.current.add(id);
    else busy.current.delete(id);
    setBusyIds([...busy.current]);
  };

  const request = useCallback(async (id, add) => {
    const { data } = add ? await api.post(`/wishlist-add/${id}`) : await api.delete(`/wishlist-remove/${id}`);
    return data.ids;
  }, []);

  // მომხმარებლის შეცვლა: გასვლა → გასუფთავება; შესვლა → ჩატვირთვა (+ სტუმრის დაგეგმილი დამატება)
  useEffect(() => {
    let cancelled = false;
    setIds([]);
    busy.current.clear();
    setBusyIds([]);
    if (!userId) {
      setStatus('idle');
      return undefined;
    }
    setStatus('loading');
    (async () => {
      try {
        const { data } = await api.get('/wishlist-ids');
        if (cancelled) return;
        setIds(data.ids);
        setStatus('ready');
        let pending = null;
        try {
          pending = sessionStorage.getItem(PENDING_KEY);
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          /* private mode */
        }
        if (pending && !data.ids.includes(pending)) {
          const next = await request(pending, true);
          if (!cancelled) {
            setIds(next);
            toast({ type: 'success', title: i18n.t('wishlist.added') });
          }
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, request, toast]);

  const idSet = useMemo(() => new Set(ids), [ids]);
  const isWishlisted = useCallback((id) => idSet.has(String(id)), [idSet]);

  const toggle = useCallback(
    async (productId) => {
      const id = String(productId);
      if (!userId) {
        try {
          sessionStorage.setItem(PENDING_KEY, id);
        } catch {
          /* ignore */
        }
        toast({ type: 'info', title: i18n.t('wishlist.loginRequired') });
        navigate('/login', { state: { from: location.pathname + location.search } });
        return;
      }
      if (busy.current.has(id)) return;
      const adding = !idSet.has(id);
      setBusy(id, true);
      setIds((prev) => (adding ? [id, ...prev.filter((x) => x !== id)] : prev.filter((x) => x !== id)));
      try {
        const next = await request(id, adding);
        setIds(next);
        toast({ type: 'success', title: i18n.t(adding ? 'wishlist.added' : 'wishlist.removed') });
      } catch (err) {
        // დაბრუნება წინა მდგომარეობაზე
        setIds((prev) => (adding ? prev.filter((x) => x !== id) : [id, ...prev.filter((x) => x !== id)]));
        toast({ type: 'error', title: i18n.t('wishlist.actionFailed'), description: apiErrorMessage(err, 'common.tryAgain') });
      } finally {
        setBusy(id, false);
      }
    },
    [userId, idSet, request, toast, navigate, location.pathname, location.search]
  );

  const value = useMemo(
    () => ({ ids, count: ids.length, status, isWishlisted, toggle, isBusy: (id) => busyIds.includes(String(id)), enabled: Boolean(userId) }),
    [ids, status, isWishlisted, toggle, busyIds, userId]
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => useContext(WishlistContext);
