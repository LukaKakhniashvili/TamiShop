import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import i18n from '../i18n';

const UIContext = createContext(null);

const TOAST_DURATION = 3500;
const iconFor = { success: 'check', error: 'alert', info: 'info' };

const Toast = ({ toast, onClose }) => {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(toast.id), 240);
  }, [onClose, toast.id]);

  useEffect(() => {
    timer.current = setTimeout(close, toast.duration);
    return () => clearTimeout(timer.current);
  }, [close, toast.duration]);

  return (
    <div
      className={`toast toast-${toast.type} ${leaving ? 'leaving' : ''}`}
      role="status"
      style={{ '--toast-dur': `${toast.duration}ms` }}
    >
      {toast.image ? (
        <img className="toast-img" src={toast.image} alt="" />
      ) : (
        <span className="toast-icon">
          <Icon name={iconFor[toast.type]} size={16} strokeWidth={2.5} />
        </span>
      )}
      <div className="toast-body">
        <div className="toast-title">{toast.title}</div>
        {toast.description && <div className="toast-desc">{toast.description}</div>}
      </div>
      {toast.action && (
        <Link to={toast.action.to} className="toast-action" onClick={close}>
          {toast.action.label}
        </Link>
      )}
      <button className="toast-close" onClick={close} aria-label={i18n.t('common.close')}>
        <Icon name="x" size={16} />
      </button>
      <span className="toast-timer" />
    </div>
  );
};

const ConfirmDialog = ({ options, onResult }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onResult(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResult]);

  return (
    <div className="dialog-backdrop" onMouseDown={() => onResult(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-icon">
          <Icon name={options.danger === false ? 'info' : 'trash'} size={22} />
        </div>
        <h3>{options.title}</h3>
        {options.message && <p>{options.message}</p>}
        <div className="dialog-actions">
          {/* დესტრუქციულ დიალოგში ფოკუსი უსაფრთხო ღილაკზეა — Enter-ით შემთხვევით არაფერი წაიშლება */}
          <button className="btn" onClick={() => onResult(false)} autoFocus={options.danger !== false}>
            {options.cancelText || i18n.t('common.cancel')}
          </button>
          <button
            className={`btn ${options.danger === false ? 'btn-primary' : 'btn-danger'}`}
            onClick={() => onResult(true)}
            autoFocus={options.danger === false}
          >
            {options.confirmText || i18n.t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const UIProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { type: 'success', duration: TOAST_DURATION, ...opts, id }]);
  }, []);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setConfirmState({ options, resolve });
      }),
    []
  );

  const handleConfirmResult = useCallback(
    (result) => {
      confirmState?.resolve(result);
      setConfirmState(null);
    },
    [confirmState]
  );

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={removeToast} />
        ))}
      </div>
      {confirmState && <ConfirmDialog options={confirmState.options} onResult={handleConfirmResult} />}
    </UIContext.Provider>
  );
};

export const useToast = () => useContext(UIContext).toast;
export const useConfirm = () => useContext(UIContext).confirm;
