import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

export const formatPrice = (value) =>
  `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾`;

export const Price = ({ price, oldPrice, onSale, className = '' }) => {
  const sale = onSale && oldPrice;
  return (
    <div className={`price ${sale ? 'sale' : ''} ${className}`}>
      <span className="price-now">{formatPrice(price)}</span>
      {sale && <span className="price-old">{formatPrice(oldPrice)}</span>}
    </div>
  );
};

// ფასდაკლების % — API აბრუნებს `discountPercent`-ს (backend/services/productStats.js).
// თუ ველი არ არის (მაგ. კალათის ძველი ჩანაწერი), ითვლება იმავე ფორმულით: ქვემოთ დამრგვალებით.
export const productDiscount = (p) => {
  if (typeof p.discountPercent === 'number') return p.discountPercent;
  return p.onSale && p.oldPrice > 0 && p.oldPrice > p.price
    ? Math.floor(((p.oldPrice - p.price) / p.oldPrice) * 100 + 1e-9)
    : 0;
};

export const Loader = ({ label }) => {
  const { t } = useTranslation();
  return (
    <div className="loader">
      <div className="spinner" />
      <span>{label || t('common.loading')}</span>
    </div>
  );
};

export const EmptyState = ({ icon = 'box', title, text, children }) => (
  <div className="empty-state">
    <div className="empty-state-icon">
      <Icon name={icon} size={36} strokeWidth={1.6} />
    </div>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {children}
  </div>
);

export const QuantityStepper = ({ value, onChange, min = 1, max = 99, size }) => {
  const { t } = useTranslation();
  return (
    <div className={`stepper ${size === 'sm' ? 'sm' : ''}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t('common.decrease')}>
        <Icon name="minus" size={16} strokeWidth={2.5} />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        aria-label={t('common.quantity')}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={t('common.increase')}>
        <Icon name="plus" size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
};

const pageList = (page, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…' + p);
    result.push(p);
  });
  return result;
};

export const Pagination = ({ page, totalPages, onChange }) => {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label={t('common.pages')}>
      <button className="page-btn" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label={t('common.previous')}>
        <Icon name="chevronLeft" size={18} />
      </button>
      {pageList(page, totalPages).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="page-gap">…</span>
        ) : (
          <button
            key={p}
            className={`page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}
      <button className="page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label={t('common.next')}>
        <Icon name="chevronRight" size={18} />
      </button>
    </nav>
  );
};

export const ProductGridSkeleton = ({ count = 8 }) => (
  <div className="product-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div className="skel-card" key={i}>
        <div className="skeleton media" />
        <div className="body">
          <div className="skeleton" style={{ height: 10, width: '40%' }} />
          <div className="skeleton" style={{ height: 14, width: '90%' }} />
          <div className="skeleton" style={{ height: 14, width: '60%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <div className="skeleton" style={{ height: 18, width: '35%' }} />
            <div className="skeleton" style={{ height: 40, width: 40, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const PasswordInput = ({ className = '', ...props }) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="input-group has-action">
      <span className="input-icon">
        <Icon name="lock" size={18} />
      </span>
      <input {...props} type={show ? 'text' : 'password'} className={`input ${className}`} />
      <button
        type="button"
        className="input-action"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
        tabIndex={-1}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
};

export const IconInput = ({ icon, className = '', ...props }) => (
  <div className="input-group">
    <span className="input-icon">
      <Icon name={icon} size={18} />
    </span>
    <input {...props} className={`input ${className}`} />
  </div>
);

export const Field = ({ label, required, hint, children, className = '' }) => (
  <label className={`field ${className}`}>
    {label && (
      <span className="field-label">
        {label}
        {required && <span className="req">*</span>}
      </span>
    )}
    {children}
    {hint && <span className="field-hint">{hint}</span>}
  </label>
);

export const Alert = ({ type = 'error', children }) =>
  children ? (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={type === 'success' ? 'check' : type === 'info' ? 'info' : 'alert'} size={18} />
      <span>{children}</span>
    </div>
  ) : null;

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={active === t.id}
        className={`tab ${active === t.id ? 'active' : ''}`}
        onClick={() => onChange(t.id)}
        type="button"
      >
        {t.icon && <Icon name={t.icon} size={16} />}
        {t.label}
        {t.count !== undefined && <span className="tab-count">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const getInitials = (user) => {
  if (!user) return '?';
  const a = user.firstName?.[0] || user.email?.[0] || '?';
  const b = user.lastName?.[0] || '';
  return `${a}${b}`;
};
