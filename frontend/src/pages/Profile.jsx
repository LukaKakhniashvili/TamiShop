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
import { EmptyState, Field, Tabs, formatPrice, getInitials } from '../components/ui';
import { paymentStatusPill, statusPill } from '../constants';
import { formatDate, useLocalized } from '../i18n/content';
import { apiErrorMessage } from '../i18n/errors';
import useDocumentMeta from '../hooks/useDocumentMeta';

// სტატუსები ბაზაში ინახება ენუმის გასაღებებით (pending, paid...) — ტექსტი თარგმანებიდან
const MyOrders = ({ cities }) => {
  const { t, i18n } = useTranslation();
  const L = useLocalized();
  const [orders, setOrders] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api
      .get('/order-my-list')
      .then(({ data }) => setOrders(data))
      .catch(() => setOrders([]));
  }, []);

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
          <div key={o._id} className={`card order-card order-acc reveal ${open ? 'open' : ''}`} style={{ '--i': i }}>
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

const Profile = () => {
  const { t } = useTranslation();
  useDocumentMeta(t('nav.myProfile'));
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'orders' ? 'orders' : 'info';

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
          onChange={(id) => setParams(id === 'orders' ? { tab: 'orders' } : {})}
          tabs={[
            { id: 'info', label: t('profile.personalInfo'), icon: 'user' },
            { id: 'orders', label: t('nav.myOrders'), icon: 'receipt' },
          ]}
        />
      </div>

      {tab === 'orders' ? (
        <MyOrders cities={cities} />
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
