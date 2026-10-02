import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import Icon from '../components/Icon';
import CitySelect, { cityLabel } from '../components/checkout/CitySelect';
import ChangePasswordCard from '../components/ChangePasswordCard';
import LineOptions from '../components/LineOptions';
import ProductCard from '../components/ProductCard';
import { useWishlist } from '../context/WishlistContext';
import { EmptyState, Field, Tabs, formatPrice, getInitials } from '../components/ui';
import { paymentStatusPill, statusPill } from '../constants';
import { formatDate, formatDateTime, useLocalized } from '../i18n/content';
import { apiErrorMessage } from '../i18n/errors';
import useDocumentMeta from '../hooks/useDocumentMeta';

// სტატუსები ბაზაში ინახება ენუმის გასაღებებით (pending, paid...) — ტექსტი თარგმანებიდან
const TRACKING_FLOW = ['pending', 'processing', 'shipped', 'completed'];

/**
 * შეკვეთის თვალთვალი: pending → processing → shipped → completed (+ გაუქმება).
 * pending-ის დრო — order.createdAt (statusHistory-ში არ ინახება), დანარჩენი — statusHistory[].at.
 * გაუქმებისას მიღწეულად ითვლება მხოლოდ გაუქმებამდე გავლილი ეტაპები.
 */
const OrderTimeline = ({ order }) => {
  const { t } = useTranslation();
  const history = order.statusHistory || [];
  const timeOf = (status) =>
    status === 'pending' ? order.createdAt : [...history].reverse().find((h) => h.to === status)?.at;
  const cancelled = order.status === 'cancelled';
  const cancelEntry = cancelled ? [...history].reverse().find((h) => h.to === 'cancelled') : null;
  // ბოლო მიღწეული ეტაპი: გაუქმებისას — სტატუსი გაუქმებამდე (from), თორემ — მიმდინარე სტატუსი
  const reachedIndex = cancelled
    ? Math.max(0, TRACKING_FLOW.indexOf(cancelEntry?.from), ...TRACKING_FLOW.map((s, i) => (i > 0 && timeOf(s) ? i : 0)))
    : Math.max(0, TRACKING_FLOW.indexOf(order.status));

  const steps = TRACKING_FLOW.map((status, i) => ({
    status,
    state: i < reachedIndex || (i === reachedIndex && (cancelled || status === 'completed')) ? 'done' : i === reachedIndex ? 'current' : 'upcoming',
    at: i <= reachedIndex ? timeOf(status) : null,
  }));
  if (cancelled) steps.push({ status: 'cancelled', state: 'cancelled', at: cancelEntry?.at });

  return (
    <div className="order-track">
      <div className="order-track-title">{t('profile.tracking.title')}</div>
      <ol className={`order-track-steps ${cancelled ? 'is-cancelled' : ''}`}>
        {steps.map((s) => (
          <li key={s.status} className={`order-track-step ${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
            <span className="order-track-dot" aria-hidden="true">
              {s.state === 'done' && <Icon name="check" size={12} strokeWidth={3} />}
              {s.state === 'cancelled' && <Icon name="x" size={12} strokeWidth={3} />}
            </span>
            <span className="order-track-text">
              <span className="order-track-label">{t(`profile.tracking.${s.status}`)}</span>
              {s.at && <time dateTime={new Date(s.at).toISOString()}>{formatDateTime(s.at)}</time>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

const MyOrders = ({ cities }) => {
  const { t, i18n } = useTranslation();
  const L = useLocalized();
  const [orders, setOrders] = useState(null);
  const [openId, setOpenId] = useState(null);
  // შეტყობინებიდან გადმოსვლა (?order=<id>) — შეკვეთა იხსნება და ჩანს
  const [params] = useSearchParams();
  const focusId = params.get('order');
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    api
      .get('/order-my-list')
      .then(({ data }) => setOrders(data))
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    if (!orders || !focusId || !orders.some((o) => o._id === focusId)) return undefined;
    setOpenId(focusId);
    setHighlightId(focusId);
    const raf = requestAnimationFrame(() => document.getElementById(`order-card-${focusId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [orders, focusId]);

  if (!orders) {
    return (
      <div className="form-stack">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton" style={{ height: 150, borderRadius: 18 }} />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="receipt" title={t('profile.noOrdersTitle')} text={t('profile.noOrdersText')}>
          <Link to="/" className="btn btn-primary">
            {t('profile.startShopping')}
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      {orders.map((o, i) => {
        const number = o.orderNumber || `#${o._id.slice(-6).toUpperCase()}`;
        const open = openId === o._id;
        return (
          <div
            key={o._id}
            id={`order-card-${o._id}`}
            className={`card order-card order-acc reveal ${open ? 'open' : ''} ${highlightId === o._id ? 'is-highlighted' : ''}`}
            style={{ '--i': i }}
          >
            {/* მობილურზე accordion: დახურულზე მხოლოდ ნომერი და ჯამი, ერთდროულად ერთი შეკვეთაა გახსნილი.
                დესკტოპზე ეს სათაური დამალულია და დეტალები ყოველთვის ჩანს (CSS) */}
            <button
              type="button"
              className="order-acc-head"
              aria-expanded={open}
              aria-controls={`order-${o._id}`}
              onClick={() => setOpenId(open ? null : o._id)}
            >
              <span className="order-acc-id">
                <strong>{t('profile.order', { number })}</strong>
                <span className="order-acc-total">{formatPrice(o.totalPrice)}</span>
              </span>
              <span className="order-acc-chev" aria-hidden="true">
                <Icon name="chevronDown" size={16} />
              </span>
            </button>
            <div className="order-acc-body" id={`order-${o._id}`}>
              <div className="order-acc-inner">
                <div className="order-acc-content">
                  <div className="order-top">
                    <div>
                      <div className="id">{t('profile.order', { number })}</div>
                      <div className="date">
                        {formatDate(o.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {o.payment?.status && (
                        <span className={`pill ${paymentStatusPill[o.payment.status] || 'pill-neutral'}`}>
                          {t(`paymentMethodShort.${o.payment.method}`, { defaultValue: o.payment.method || '' })} ·{' '}
                          {t(`paymentStatus.${o.payment.status}`, { defaultValue: o.payment.status })}
                        </span>
                      )}
                      {o.payment?.refundRequired && <span className="pill pill-warning">{t('profile.refundPending')}</span>}
                      <span className={`pill ${statusPill[o.status] || 'pill-neutral'}`}>{t(`orderStatus.${o.status}`, { defaultValue: o.status })}</span>
                    </div>
                  </div>
                  <OrderTimeline order={o} />
                  <div className="order-delivery">
                    <Icon name="pin" size={15} />
                    {cityLabel(cities, o.customerInfo?.address?.city, i18n.language)}, {o.customerInfo?.address?.street}
                    {o.delivery?.estimate && <span className="muted"> · {t('checkout.deliveryEstimate', { min: 2, max: 6 })}</span>}
                  </div>
                  <div className="order-lines">
                    {o.items.map((it, idx) => (
                      <div key={idx}>
                        <span>
                          {L(it, 'name')} <span className="muted">× {it.quantity}</span>
                          <LineOptions options={it.variant?.options} />
                        </span>
                        <span>{formatPrice(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="order-total">
                    <span>{t('cart.total')}</span>
                    <span>{formatPrice(o.totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Profile → რჩეულები: არსებული ProductCard (ფასი, ფასდაკლება, მარაგი, კალათა — ვარიანტების წესებით).
 * სია მიმდინარე პროდუქტის მონაცემებით მოდის; გულით ამოღებული ბარათი სიიდან მაშინვე ქრება.
 */
const WishlistTab = () => {
  const { t } = useTranslation();
  const { ids, status: idsStatus } = useWishlist();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    api
      .get('/wishlist-list')
      .then(({ data }) => setProducts(data.products))
      .catch(() => setError(true));
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="card">
        <EmptyState icon="alert" title={t('wishlist.loadFailed')} text={t('catalog.loadErrorText')}>
          <button type="button" className="btn btn-primary" onClick={load}>
            <Icon name="refresh" size={16} /> {t('common.retry')}
          </button>
        </EmptyState>
      </div>
    );
  }
  if (!products || idsStatus === 'loading') {
    return (
      <div className="product-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ aspectRatio: '3 / 4', borderRadius: 18 }} />
        ))}
      </div>
    );
  }
  const idSet = new Set(ids);
  const visible = products.filter((p) => idSet.has(String(p._id)));
  if (!visible.length) {
    return (
      <div className="card">
        <EmptyState icon="heart" title={t('wishlist.emptyTitle')} text={t('wishlist.emptyText')}>
          <Link to="/products" className="btn btn-primary">
            {t('wishlist.browse')} <Icon name="arrowRight" size={16} />
          </Link>
        </EmptyState>
      </div>
    );
  }
  return (
    <div>
      <p className="muted wishlist-count">{t('wishlist.count', { count: visible.length })}</p>
      <div className="product-grid wishlist-grid">
        {visible.map((p, i) => (
          <ProductCard key={p._id} product={p} index={i} />
        ))}
      </div>
    </div>
  );
};

const Profile = () => {
  const { t } = useTranslation();
  useDocumentMeta(t('nav.myProfile'));
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = ['orders', 'wishlist'].includes(params.get('tab')) ? params.get('tab') : 'info';

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    city: user?.address?.city || '',
    street: user?.address?.street || '',
    postalCode: user?.address?.postalCode || '',
  });
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    api
      .get('/order-checkout-options')
      .then(({ data }) => setCities(data.cities))
      .catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        address: { city: form.city, street: form.street, postalCode: form.postalCode },
      });
      toast({ title: t('profile.saved') });
    } catch (err) {
      toast({ type: 'error', title: t('profile.saveFailed'), description: apiErrorMessage(err, 'common.tryAgain') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 860 }}>
      <div className="card profile-head">
        <span className="avatar avatar-lg">{getInitials(user)}</span>
        <div style={{ minWidth: 0 }}>
          <h1>
            {user?.firstName} {user?.lastName}
          </h1>
          <p>{user?.email}</p>
        </div>
      </div>

      <div className="profile-tabs">
        <Tabs
          active={tab}
          onChange={(id) => setParams(id === 'info' ? {} : { tab: id })}
          tabs={[
            { id: 'info', label: t('profile.personalInfo'), icon: 'user' },
            { id: 'orders', label: t('nav.myOrders'), icon: 'receipt' },
            { id: 'wishlist', label: t('wishlist.title'), icon: 'heart' },
          ]}
        />
      </div>

      {tab === 'orders' ? (
        <MyOrders cities={cities} />
      ) : tab === 'wishlist' ? (
        <WishlistTab />
      ) : (
        <form className="form-stack" onSubmit={handleSubmit}>
          <section className="card card-pad">
            <h2 className="card-title">
              <Icon name="user" size={18} /> {t('profile.personalData')}
            </h2>
            <div className="form-grid">
              <Field label={t('checkout.firstName')}>
                <input className="input" name="firstName" value={form.firstName} onChange={handleChange} autoComplete="given-name" />
              </Field>
              <Field label={t('checkout.lastName')}>
                <input className="input" name="lastName" value={form.lastName} onChange={handleChange} autoComplete="family-name" />
              </Field>
              <Field label={t('checkout.phone')} className="span-2">
                <input className="input" name="phone" type="tel" value={form.phone} onChange={handleChange} autoComplete="tel" />
              </Field>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="card-title">
              <Icon name="pin" size={18} /> {t('checkout.street')}
            </h2>
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="profile-city">
                  {t('checkout.city')}
                </label>
                <CitySelect
                  id="profile-city"
                  cities={cities}
                  value={form.city}
                  onChange={(city) => setForm((f) => ({ ...f, city }))}
                />
              </div>
              <Field label={t('checkout.postalCode')}>
                <input className="input" name="postalCode" value={form.postalCode} onChange={handleChange} autoComplete="postal-code" />
              </Field>
              <Field label={t('checkout.street')} className="span-2">
                <input className="input" name="street" value={form.street} onChange={handleChange} autoComplete="street-address" />
              </Field>
            </div>
          </section>

          <div className="form-actions">
            <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : <Icon name="check" size={18} />} {t('profile.saveChanges')}
            </button>
          </div>
        </form>
      )}

      {/* ცალკე ფორმა — პროფილის მონაცემების შენახვა და პაროლის შეცვლა ერთმანეთს არ ერევა */}
      {tab === 'info' && <ChangePasswordCard />}
    </div>
  );
};

export default Profile;
