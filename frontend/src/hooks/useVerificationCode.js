import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { apiErrorMessage } from '../i18n/errors';

/*
 * ერთჯერადი კოდის ნაკადის საერთო ლოგიკა (რეგისტრაცია, პაროლის აღდგენა):
 * გაგზავნა / ხელახლა გაგზავნა, 30 წმ ლოდინი, 3 წთ ვადა, გვერდის განახლების შემდეგ აღდგენა.
 * სერვერი რჩება ჭეშმარიტების წყაროდ — ტაიმერები მისი პასუხიდან მოდის (წამებში).
 */

// სარეზერვო მნიშვნელობები, თუ სერვერის პასუხში არ არის
const DEFAULT_RESEND_SECONDS = 30;
const DEFAULT_VALIDITY_SECONDS = 180;

export const secondsLeft = (at, now) => Math.max(0, Math.ceil((at - now) / 1000));
export const formatClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ყოველ წამში ხელახალი რენდერი (მხოლოდ მაშინ, როცა ტაიმერი საჭიროა); დრო თავად რენდერში იკითხება
const useSecondTicker = (active) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

// გვერდის განახლებისას მხოლოდ ელ. ფოსტა ინახება (კოდი — არასდროს)
const makeStorage = (key) => ({
  get: () => {
    try {
      return sessionStorage.getItem(key) || '';
    } catch {
      return '';
    }
  },
  set: (email) => {
    try {
      sessionStorage.setItem(key, email);
    } catch {
      /* private mode — refresh-ის აღდგენა უბრალოდ არ იმუშავებს */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
});

/**
 * @param {object} o
 * @param {string} o.sendUrl      — POST { email }
 * @param {string} o.statusUrl    — GET ?email=
 * @param {string} o.storageKey   — sessionStorage გასაღები (მხოლოდ ელ. ფოსტისთვის)
 * @param {boolean} [o.done]      — ნაკადი დასრულდა (ტაიმერი ჩერდება)
 * @param {(email: string) => void} [o.onRestore] — refresh-ის შემდეგ აღდგენილი ელ. ფოსტა
 */
const useVerificationCode = ({ sendUrl, statusUrl, storageKey, done = false, onRestore }) => {
  const [storage] = useState(() => makeStorage(storageKey));
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(null); // null | 'initial' | 'resend' — დუბლირებული მოთხოვნების თავიდან ასაცილებლად
  const [timers, setTimers] = useState({ resendAt: 0, expiresAt: 0, validitySeconds: DEFAULT_VALIDITY_SECONDS });

  const now = Date.now();
  useSecondTicker(!done && (codeSent || timers.resendAt > now));
  const resendIn = secondsLeft(timers.resendAt, now);
  const expiresIn = secondsLeft(timers.expiresAt, now);
  const codeExpired = codeSent && expiresIn === 0;

  const applyTimers = useCallback((data) => {
    const t = Date.now();
    setTimers((prev) => ({
      resendAt: t + (data.resendAvailableInSeconds || 0) * 1000,
      expiresAt: data.expiresInSeconds !== undefined ? t + data.expiresInSeconds * 1000 : prev.expiresAt,
      validitySeconds: data.codeValiditySeconds || prev.validitySeconds,
    }));
  }, []);

  const reset = useCallback(() => {
    setCodeSent(false);
    setTimers((t) => ({ ...t, resendAt: 0, expiresAt: 0 }));
    storage.clear();
  }, [storage]);

  const markExpired = useCallback(() => setTimers((t) => ({ ...t, expiresAt: 0 })), []);
  const clearStorage = useCallback(() => storage.clear(), [storage]);

  // გვერდის განახლების შემდეგ — აქტიური კოდის და ლოდინის დროის აღდგენა სერვერიდან
  useEffect(() => {
    const email = storage.get();
    if (!email) return;
    onRestore?.(email);
    api
      .get(statusUrl, { params: { email } })
      .then(({ data }) => {
        if (data.active || data.resendAvailableInSeconds > 0) {
          applyTimers(data);
          setCodeSent(true);
        } else storage.clear();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * კოდის გაგზავნა. აბრუნებს { ok: true, isResend } ან { ok: false, error, data, status }.
   * წარმატება მოდის მხოლოდ მას შემდეგ, რაც სერვერი დაადასტურებს, რომ წერილი მიღებულია.
   */
  const send = async (email) => {
    if (sending || resendIn > 0) return { ok: false, skipped: true };
    const isResend = codeSent;
    setSending(isResend ? 'resend' : 'initial');
    try {
      const { data } = await api.post(sendUrl, { email });
      applyTimers({
        resendAvailableInSeconds: data?.resendAvailableInSeconds ?? DEFAULT_RESEND_SECONDS,
        expiresInSeconds: data?.expiresInSeconds ?? DEFAULT_VALIDITY_SECONDS,
        codeValiditySeconds: data?.codeValiditySeconds ?? DEFAULT_VALIDITY_SECONDS,
      });
      setCodeSent(true);
      storage.set(email.trim().toLowerCase());
      return { ok: true, isResend };
    } catch (err) {
      const data = err.response?.data;
      // ლოდინის დრო ჯერ არ გასულა — ტაიმერი სერვერის მონაცემით სინქრონიზდება, კოდი არ იცვლება
      if (err.response?.status === 429 && data?.code === 'RESEND_COOLDOWN') {
        const wait = Number(data?.resendAvailableInSeconds || err.response.headers?.['retry-after']) || DEFAULT_RESEND_SECONDS;
        applyTimers({ resendAvailableInSeconds: wait });
      }
      return { ok: false, status: err.response?.status, data, error: apiErrorMessage(err, 'otp.sendFailed') };
    } finally {
      setSending(null);
    }
  };

  return { codeSent, sending, resendIn, expiresIn, codeExpired, validitySeconds: timers.validitySeconds, send, reset, markExpired, clearStorage };
};

export default useVerificationCode;
