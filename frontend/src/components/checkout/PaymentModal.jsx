import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import i18n from '../../i18n';
import { apiErrorMessage } from '../../i18n/errors';
import Icon from '../Icon';
import { formatPrice } from '../ui';

// დაბრუნების გვერდის შეტყობინება (pages/PaymentReturn.jsx)
export const PAYMENT_RETURN_MESSAGE = 'tamo:payment-return';

const BACKGROUND_POLL_MS = 5000;
const VERIFY_ATTEMPTS = 8;
const VERIFY_INTERVAL_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ბანკის გადახდის მოდალი.
 *
 * init     — სერვერი ქმნის ბანკის სესიას (POST /payments/:orderId/init) → { paymentUrl }
 * frame    — ბანკის გვერდი iframe-ში; ბარათის მონაცემებს მხოლოდ ბანკი იღებს
 * verifying— ბანკმა დააბრუნა მომხმარებელი; სერვერი ამოწმებს სტატუსს ბანკთან
 * failed   — უარყოფილი/გაუქმებული გადახდა (თავიდან ცდა შესაძლებელია)
 * error    — სესიის შექმნა ვერ მოხერხდა
 *
 * შედეგს ყოველთვის სერვერი ადგენს (GET /payments/:orderId/status) — არა iframe-ის URL.
 */
const PaymentModal = ({ order, bank, onClose, onPaid }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('init');
  const [session, setSession] = useState(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [stillPending, setStillPending] = useState(false);
  const finished = useRef(false);
  const verifying = useRef(false);
  const dialogRef = useRef(null);

  const finishPaid = useCallback(
    (paidOrder) => {
      if (finished.current) return;
      finished.current = true;
      onPaid(paidOrder);
    },
    [onPaid]
  );

  const start = useCallback(async () => {
    setPhase('init');
    setSession(null);
    setFrameLoaded(false);
    setMessage('');
    setStillPending(false);
    try {
      const { data } = await api.post(`/payment-init/${order._id}`, { bank: bank.id });
      setSession(data);
      setPhase('frame');
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.status === 'paid') {
        finishPaid(err.response.data.order);
        return;
      }
      setMessage(apiErrorMessage(err, 'payment.loadFailedText'));
      setPhase('error');
    }
  }, [order._id, bank.id, finishPaid]);

  useEffect(() => {
    start();
  }, [start]);

  // სტატუსის შემოწმება სერვერთან; true — თუ საბოლოო შედეგი მივიღეთ
  const checkStatus = useCallback(async () => {
    const { data } = await api.get(`/payment-status/${order._id}`);
    if (data.status === 'paid') {
      finishPaid(data.order);
      return true;
    }
    if (data.status === 'failed' || data.status === 'cancelled') {
      // სერვერის ტექსტი ქართულია — სხვა ენაზე სტატუსის მიხედვით ვთარგმნით
      const fallback = i18n.t(data.status === 'cancelled' ? 'payment.cancelled' : 'payment.declined');
      setMessage(i18n.language === 'ka' && data.message ? data.message : fallback);
      setPhase('failed');
      return true;
    }
    return false;
  }, [order._id, finishPaid]);

  // ბანკიდან დაბრუნების შემდეგ — რამდენჯერმე ვამოწმებთ, სანამ ბანკი სტატუსს დაასრულებს
  const verify = useCallback(async () => {
    if (verifying.current || finished.current) return;
    verifying.current = true;
    setPhase('verifying');
    setStillPending(false);
    try {
      for (let i = 0; i < VERIFY_ATTEMPTS; i++) {
        if (await checkStatus()) return;
        await sleep(VERIFY_INTERVAL_MS);
      }
      setStillPending(true);
    } catch {
      setStillPending(true);
    } finally {
      verifying.current = false;
    }
  }, [checkStatus]);

  // დაბრუნების გვერდი (iframe-ში ან ახალ ფანჯარაში) გვატყობინებს postMessage-ით
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === PAYMENT_RETURN_MESSAGE && e.data.orderId === order._id) verify();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [order._id, verify]);

  // ფონური შემოწმება, სანამ ბანკის გვერდი ღიაა (მაგ. თუ გადახდა ახალ ფანჯარაში დასრულდა)
  useEffect(() => {
    if (phase !== 'frame') return;
    const timer = setInterval(() => {
      checkStatus().catch(() => {});
    }, BACKGROUND_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, checkStatus]);

  // Escape, სქროლის ბლოკი, ფოკუსი
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const sandbox = session?.mode === 'sandbox' || bank.mode === 'sandbox';

  return (
    <div className="pay-modal-backdrop" onMouseDown={onClose}>
      <div
        className="pay-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-title"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="pay-modal-head">
          <span className={`bank-mark bank-${bank.id.toLowerCase()}`}>{bank.short}</span>
          <div className="pay-modal-title">
            <strong id="pay-modal-title">{t(`checkout.banks.${bank.id}`, { defaultValue: bank.name })}</strong>
            <span>
              <Icon name="lock" size={13} /> {t('payment.secureOrder', { number: order.orderNumber })}
            </span>
          </div>
          <span className="pay-modal-amount">{formatPrice(order.totalPrice)}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={20} />
          </button>
        </header>

        <div className="pay-modal-body">
          {phase === 'frame' && session?.paymentUrl && (
            <>
              <iframe
                key={session.sessionId}
                src={session.paymentUrl}
                title={t('payment.frameTitle', { bank: bank.latin })}
                className={`pay-frame ${frameLoaded ? 'loaded' : ''}`}
                onLoad={() => setFrameLoaded(true)}
                allow="payment"
                referrerPolicy="origin"
              />
              {!frameLoaded && (
                <div className="pay-state overlay">
                  <span className="spinner" />
                  <strong>{t('payment.loadingBank')}</strong>
                </div>
              )}
            </>
          )}

          {phase === 'init' && (
            <div className="pay-state">
              <span className="spinner" />
              <strong>{t('payment.connecting')}</strong>
              <span>{t('payment.preparing')}</span>
            </div>
          )}

          {phase === 'verifying' && (
            <div className="pay-state">
              <span className="spinner" />
              <strong>{stillPending ? t('payment.stillProcessing') : t('payment.verifying')}</strong>
              {stillPending ? (
                <>
                  <span>{t('payment.stillProcessingText')}</span>
                  <button type="button" className="btn" onClick={verify}>
                    <Icon name="refresh" size={16} /> {t('payment.checkAgain')}
                  </button>
                </>
              ) : (
                <span>{t('payment.dontClose')}</span>
              )}
            </div>
          )}

          {(phase === 'failed' || phase === 'error') && (
            <div className="pay-state">
              <span className="pay-state-icon">
                <Icon name="alert" size={28} />
              </span>
              <strong>{phase === 'failed' ? t('payment.failedTitle') : t('payment.loadFailedTitle')}</strong>
              <span>{message}</span>
              <span className="muted">{t('payment.notCharged')}</span>
              <div className="pay-state-actions">
                <button type="button" className="btn" onClick={onClose}>
                  {t('payment.otherMethod')}
                </button>
                <button type="button" className="btn btn-primary" onClick={start}>
                  <Icon name="refresh" size={16} /> {t('common.retry')}
                </button>
              </div>
            </div>
          )}
        </div>

        {phase === 'frame' && session?.paymentUrl && (
          <footer className="pay-modal-foot">
            <span>
              <Icon name="shield" size={14} /> {t('checkout.cardSecurityNote')}
              {sandbox && <span className="pill pill-warning no-dot">{t('payment.testMode')}</span>}
            </span>
            <a href={session.paymentUrl} target="_blank" rel="noopener">
              {t('payment.openNewWindow')} <Icon name="arrowRight" size={14} />
            </a>
          </footer>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
