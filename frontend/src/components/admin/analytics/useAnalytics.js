import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../api/axios';

/**
 * ერთი სექციის მონაცემები (დამოუკიდებელი ჩატვირთვა / შეცდომა / ხელახლა ცდა).
 * დიაპაზონის შეცვლისას ძველი მონაცემი ჩანს, სანამ ახალი არ მოვა (status: 'refreshing').
 * params = null → დიაპაზონის გარეშე (მაგ. რჩეულები — მხოლოდ მიმდინარე მდგომარეობა).
 */
const useAnalytics = (path, params) => {
  const [state, setState] = useState({ data: null, status: 'loading', error: null });
  const reqId = useRef(0);
  const key = params ? JSON.stringify(params) : '';

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading', error: null }));
    try {
      const { data } = await api.get(`/${path}`, { params: params || undefined });
      if (id === reqId.current) setState({ data, status: 'ready', error: null });
    } catch (err) {
      if (id === reqId.current) setState((s) => ({ ...s, status: 'error', error: err.response?.data?.message || 'მონაცემების ჩატვირთვა ვერ მოხერხდა' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: load };
};

export default useAnalytics;
