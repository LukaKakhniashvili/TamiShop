import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import Icon from '../Icon';
import { Alert, formatPrice } from '../ui';
import { nextStatusActionLabels, paymentMethodLabels, paymentStatusLabels, paymentStatusPill, statusLabels, statusPill } from '../../constants';

// ნორმალური მიმდევრობა — მხოლოდ ვიზუალიზაციისთვის; რომელი ნაბიჯია დასაშვები, წყვეტს სერვერი (order.actions)
const FLOW = ['pending', 'processing', 'shipped', 'completed'];

export const orderNo = (o) => o.orderNumber || `#${o._id.slice(-6).toUpperCase()}`;

const StatusFlow = ({ status }) => {
  const current = FLOW.indexOf(status);
  return (
    <ol className="status-flow" aria-label="შეკვეთის ეტაპები">
      {FLOW.map((s, i) => (
        <li
          key={s}
          className={`${status === 'cancelled' ? 'muted-step' : i < current ? 'done' : i === current ? 'current' : ''}`}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="status-flow-dot">{i < current ? <Icon name="check" size={11} strokeWidth={3.5} /> : i + 1}</span>
          <span className="status-flow-label">{statusLabels[s]}</span>
        </li>
      ))}
    </ol>
  );
};

/**
 * შეკვეთის მართვის ფანჯარა: კონტექსტი + მხოლოდ დასაშვები მოქმედებები.
 * view: 'menu' → 'advance' (სტატუსის შეცვლის დადასტურება) | 'cancel' (გაუქმების დადასტურება)
 */
const OrderManageModal = ({ order, onClose, onDone }) => {
  const [view, setView] = useState('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const next = order.actions?.next;
  const canCancel = order.actions?.canCancel;
  const number = orderNo(order);

  // Escape ხურავს (მოთხოვნის დროს — არა); ფოკუსი ფანჯრის შიგნით რჩება
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        if (view === 'menu') onClose();
        else setView('menu');
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href]')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, view, onClose]);

  // ფონის სქროლი ჩაკეტილია, სანამ ფანჯარა ღიაა
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const run = async (request, successTitle) => {
    setBusy(true);
    setError('');
    try {
      await request();
      onDone(successTitle);
    } catch (err) {
      setError(err.response?.data?.message || 'მოქმედება ვერ შესრულდა. სცადეთ თავიდან.');
      setView('menu');
    } finally {
      setBusy(false);
    }
  };

  const advance = () =>
    run(() => api.put(`/order-status-update/${order._id}`, { status: next }), 'შეკვეთის სტატუსი წარმატებით განახლდა.');
  const cancel = () => run(() => api.post(`/order-admin-cancel/${order._id}`), 'შეკვეთა გაუქმდა.');

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        className="dialog order-manage"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-manage-title"
        aria-describedby="order-manage-desc"
      >
        {view === 'menu' && (
          <>
            <div className="order-manage-head">
              <div>
                <h3 id="order-manage-title">შეკვეთის მართვა</h3>
                <p id="order-manage-desc" className="order-manage-number">{number}</p>
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="დახურვა" disabled={busy}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <dl className="order-manage-info">
              <div>
                <dt>მიმდინარე სტატუსი</dt>
                <dd>
                  <span className={`pill ${statusPill[order.status] || 'pill-neutral'}`}>{statusLabels[order.status]}</span>
                </dd>
              </div>
              <div>
                <dt>მომხმარებელი</dt>
                <dd>
                  {order.customerInfo.firstName} {order.customerInfo.lastName}
                </dd>
              </div>
              <div>
                <dt>თარიღი</dt>
                <dd>{new Date(order.createdAt).toLocaleString('ka-GE', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </div>
              <div>
                <dt>ჯამი</dt>
                <dd className="strong">{formatPrice(order.totalPrice)}</dd>
              </div>
              {order.payment?.status && (
                <div>
                  <dt>გადახდა</dt>
                  <dd>
                    <span className={`pill ${paymentStatusPill[order.payment.status] || 'pill-neutral'}`}>
                      {paymentMethodLabels[order.payment.method]} · {paymentStatusLabels[order.payment.status]}
                    </span>
                  </dd>
                </div>
              )}
            </dl>

            <StatusFlow status={order.status} />

            <Alert>{error}</Alert>

            <div className="order-manage-actions">
              {next && (
                <button type="button" className="btn btn-primary" onClick={() => setView('advance')} autoFocus>
                  <Icon name="arrowRight" size={16} /> {nextStatusActionLabels[next]}
                </button>
              )}
              {canCancel && (
                <button type="button" className="btn order-cancel" onClick={() => setView('cancel')} autoFocus={!next}>
                  <Icon name="x" size={16} /> შეკვეთის გაუქმება
                </button>
              )}
              {!next && !canCancel && (
                <p className="order-manage-note">
                  <Icon name="info" size={16} /> შეკვეთა საბოლოო სტატუსშია — სხვა მოქმედება ხელმისაწვდომი არ არის.
                </p>
              )}
              {!next && canCancel && (
                <p className="order-manage-note">
                  <Icon name="info" size={16} /> ბარათით გადახდა არ დასრულებულა — შეკვეთის დამუშავება შეუძლებელია.
                </p>
              )}
              <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus={!next && !canCancel}>
                დახურვა
              </button>
            </div>
          </>
        )}

        {view === 'advance' && (
          <>
            <div className="dialog-icon info-tone">
              <Icon name="refresh" size={22} />
            </div>
            <h3 id="order-manage-title">სტატუსის შეცვლა?</h3>
            <p id="order-manage-desc">
              შეკვეთის <strong>{number}</strong> სტატუსი შეიცვლება „{statusLabels[order.status]}"-დან „{statusLabels[next]}"-ზე.
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setView('menu')} disabled={busy} autoFocus>
                გაუქმება
              </button>
              <button type="button" className="btn btn-primary" onClick={advance} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" size={16} />} სტატუსის შეცვლის დადასტურება
              </button>
            </div>
          </>
        )}

        {view === 'cancel' && (
          <>
            <div className="dialog-icon">
              <Icon name="trash" size={22} />
            </div>
            <h3 id="order-manage-title">შეკვეთის გაუქმება?</h3>
            <p id="order-manage-desc">
              ნამდვილად გსურთ შეკვეთის <strong>{number}</strong> გაუქმება? შეკვეთის სტატუსი შეიცვლება „გაუქმებულით".
            </p>
            <div className="dialog-actions">
              {/* დესტრუქციულ დიალოგში ფოკუსი უსაფრთხო ღილაკზეა */}
              <button type="button" className="btn" onClick={() => setView('menu')} disabled={busy} autoFocus>
                შეკვეთის შენარჩუნება
              </button>
              <button type="button" className="btn btn-danger" onClick={cancel} disabled={busy}>
                {busy ? <span className="spinner" /> : null} დიახ, გააუქმე შეკვეთა
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderManageModal;
