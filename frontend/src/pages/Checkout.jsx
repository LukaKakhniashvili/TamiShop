import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UIContext';
import { useLocalized } from '../i18n/content';
import { apiErrorMessage } from '../i18n/errors';
import useDocumentMeta from '../hooks/useDocumentMeta';
import Icon from '../components/Icon';
import { Alert, EmptyState, Field, Loader, formatPrice } from '../components/ui';
import CitySelect, { cityLabel } from '../components/checkout/CitySelect';
import OrderConfirmation from '../components/checkout/OrderConfirmation';
import PaymentModal from '../components/checkout/PaymentModal';
import LineOptions from '../components/LineOptions';

const DELIVERY_FIELDS = ['firstName', 'lastName', 'phone', 'city', 'street'];

// კლიენტის ვალიდაცია — იგივე წესები, რასაც სერვერი ამოწმებს (backend/controllers/orderController.js).
// აბრუნებს თარგმანის გასაღებებს (ტექსტი — t()-ით, ენის შეცვლისას შეცდომაც ითარგმნება)
const validateDelivery = (form, cityNames) => {
  const e = {};
  if (!form.firstName.trim()) e.firstName = 'checkout.errors.firstName';
  if (!form.lastName.trim()) e.lastName = 'checkout.errors.lastName';
  if (!/^[+\d][\d\s-]{7,}$/.test(form.phone.trim())) e.phone = 'checkout.errors.phone';
  if (!cityNames.has(form.city)) e.city = 'checkout.errors.city';
  if (form.street.trim().length < 5) e.street = 'checkout.errors.street';
  return e;
};

const Steps = ({ step }) => {
  const { t } = useTranslation();
  const steps = [
    { id: 'delivery', label: t('checkout.steps.delivery') },
    { id: 'payment', label: t('checkout.steps.payment') },
    { id: 'done', label: t('checkout.steps.done') },
  ];
  const current = steps.findIndex((s) => s.id === step);
  return (
    <div className="steps checkout-steps" aria-label={t('checkout.steps.label')}>
      {steps.map((s, i) => (
        <div key={s.id} style={{ display: 'contents' }}>
          {i > 0 && <div className={`line ${i <= current ? 'done' : ''}`} />}
          <div className={`step ${i < current ? 'done' : i === current ? 'active' : ''}`} aria-current={i === current ? 'step' : undefined}>
            <span className="dot">{i < current ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
            <span className="step-label">{s.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// მიწოდების მეთოდის ტექსტები — id-ით თარგმანებიდან (სერვერის ქართული ტექსტი — fallback)
export const useDeliveryText = () => {
  const { t } = useTranslation();
  return (method) =>
    method
      ? {
          label: t(`checkout.deliveryMethods.${method.id}`, { defaultValue: method.label }),
          estimate: t('checkout.deliveryEstimate', { min: method.minDays, max: method.maxDays }),
          coverage: t('checkout.deliveryCoverage'),
        }
      : { label: '', estimate: '', coverage: '' };
};

const DeliveryInfo = ({ method }) => {
  const { t } = useTranslation();
  const text = useDeliveryText()(method);
  return method ? (
    <div className="delivery-info">
      <div className="delivery-info-head">
        <span className="delivery-info-icon">
          <Icon name="truck" size={22} />
        </span>
        <div>
          <strong>{t('checkout.freeDeliveryEverywhere')}</strong>
          <span>
            {text.label} · {text.estimate}
          </span>
        </div>
        <span className="pill pill-success no-dot">{t('common.free')}</span>
      </div>
      <dl className="delivery-info-grid">
        <div>
          <dt>{t('checkout.deliveryType')}</dt>
          <dd>{t('checkout.standard')}</dd>
        </div>
        <div>
          <dt>{t('checkout.cost')}</dt>
          <dd className="free">{method.cost > 0 ? formatPrice(method.cost) : t('common.free')}</dd>
        </div>
        <div>
          <dt>{t('checkout.estimatedTime')}</dt>
          <dd>{text.estimate}</dd>
        </div>
        <div>
          <dt>{t('checkout.coverage')}</dt>
          <dd>{text.coverage}</dd>
        </div>
      </dl>
    </div>
  ) : null;
};

const PAYMENT_ICONS = { card: 'card', cod: 'truck' };

// ბარათით გადახდა აქტიურია მხოლოდ მაშინ, როცა სერვერი პირდაპირ ადასტურებს (enabled: true, CARD_PAYMENTS_ENABLED);
// დანარჩენი მეთოდები — თუ სერვერი არ გამორთავს. ძველი/უცნობი პასუხის დროს ბარათი გამორთული რჩება.
const isMethodAvailable = (m) => (m.id === 'card' ? m.enabled === true : m.enabled !== false);

const Checkout = () => {
  const { t } = useTranslation();
  const L = useLocalized();
  const deliveryText = useDeliveryText();
  const { items, totalPrice, totalItems, clearCart, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  useDocumentMeta(t('checkout.title'));

  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState(false);
  const [step, setStep] = useState('delivery');
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    city: user?.address?.city || '',
    street: user?.address?.street || '',
    postalCode: user?.address?.postalCode || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bankId, setBankId] = useState('');
  const [errors, setErrors] = useState({}); // field → თარგმანის გასაღები
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  // ბარათით გადახდისთვის შექმნილი (ჯერ გადაუხდელი) შეკვეთა — თავიდან ცდისას ხელახლა გამოიყენება
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    api
      .get('/order-checkout-options')
      .then(({ data }) => setOptions(data))
      .catch(() => setOptionsError(true));
  }, []);

  const cityNames = useMemo(() => new Set((options?.cities || []).map((c) => c.name)), [options]);
  const delivery = options?.deliveryMethods.find((d) => d.id === options.defaultDeliveryMethod);
  const dText = deliveryText(delivery);
  const paymentLabel = (id) => t(`checkout.paymentMethods.${id}.label`);
  const bankName = (b) => t(`checkout.banks.${b.id}`, { defaultValue: b.name });

  // შენახული ქალაქი, რომელიც სიაში არ არის (ძველი ხელით შეყვანილი), ცარიელდება
  useEffect(() => {
    if (options && form.city && !cityNames.has(form.city)) setForm((f) => ({ ...f, city: '' }));
  }, [options]);

  // თუ მხოლოდ ერთი მეთოდია აქტიური (ბარათი დროებით გამორთულია) — ის წინასწარ არჩეულია
  useEffect(() => {
    const enabled = (options?.paymentMethods || []).filter(isMethodAvailable);
    if (enabled.length === 1 && !paymentMethod) setPaymentMethod(enabled[0].id);
  }, [options]);

  const originalTotal = items.reduce((s, i) => s + (i.oldPrice || i.price) * i.quantity, 0);
  const discountTotal = Math.max(0, originalTotal - totalPrice);
  const deliveryCost = delivery?.cost || 0;
  const grandTotal = totalPrice + deliveryCost;

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const onInput = (e) => setField(e.target.name, e.target.value);

  const goToPayment = (e) => {
    e.preventDefault();
    const e2 = validateDelivery(form, cityNames);
    setErrors(e2);
    if (Object.keys(e2).length) {
      document.getElementById(`f-${Object.keys(e2)[0]}`)?.focus();
      return;
    }
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedBank = options?.banks?.find((b) => b.id === bankId && b.mode);

  const orderPayload = () => ({
    // ფასი არ იგზავნება — სერვერი ფასს პროდუქტიდან/ვარიანტიდან ითვლის
    items: items.map((i) => ({ productId: i.productId, ...(i.variantId ? { variantId: i.variantId } : {}), quantity: i.quantity })),
    customerInfo: {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      address: { city: form.city, street: form.street, postalCode: form.postalCode },
    },
    deliveryMethod: delivery?.id,
    paymentMethod,
    bank: paymentMethod === 'card' ? bankId : undefined,
  });

  // კალათის/მისამართის ცვლილებისას ძველი გადაუხდელი შეკვეთა აღარ გამოდგება — იქმნება ახალი.
  // ბანკის ცვლილება ახალ შეკვეთას არ საჭიროებს (ბანკი გადაეცემა სესიის შექმნისას).
  const orderSignature = JSON.stringify({ items: orderPayload().items, customerInfo: orderPayload().customerInfo });
  const reusableOrder = pendingOrder?.signature === orderSignature ? pendingOrder.order : null;
  // ღილაკზე — შეკვეთის საბოლოო თანხა (სერვერის, თუ შეკვეთა უკვე შექმნილია)
  const payableTotal = reusableOrder ? reusableOrder.totalPrice : grandTotal;

  const completeOrder = useCallback(
    (order) => {
      setPaymentOpen(false);
      setPendingOrder(null);
      setPlacedOrder(order);
      setStep('done');
      clearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [clearCart]
  );
  const closePayment = useCallback(() => setPaymentOpen(false), []);

  // გადაუხდელი (draft) შეკვეთის გაუქმება სერვერზე — მისი გადახდის სესიაც ბათილდება
  const cancelDraft = (order, reason) => api.post(`/order-cancel/${order._id}`, { reason });

  // კალათის ან მისამართის ცვლილებისას ძველი შეკვეთა (ძველი თანხით) უქმდება, რომ მისი გადახდის
  // სესია ვეღარ გამოიყენონ. შემდეგი გადახდა შექმნის ახალ შეკვეთას განახლებული თანხით.
  useEffect(() => {
    if (!pendingOrder || pendingOrder.signature === orderSignature) return;
    const stale = pendingOrder.order;
    setPendingOrder(null);
    setPaymentOpen(false);
    cancelDraft(stale, 'cart_changed').catch((err) => {
      // ძველი შეკვეთა ამასობაში გადახდილი აღმოჩნდა — ვაჩვენებთ მის დადასტურებას
      if (err.response?.status === 409 && err.response.data?.status === 'paid') completeOrder(err.response.data.order);
    });
  }, [orderSignature]);

  // პროდუქტის ამოღება შეჯამებიდან — კალათის არსებული ლოგიკით (removeFromCart), ანიმაციით
  const [removingId, setRemovingId] = useState(null);
  const removeItem = (lineId) => {
    if (submitting || paymentOpen || removingId) return;
    setRemovingId(lineId);
    setTimeout(() => {
      removeFromCart(lineId);
      setRemovingId(null);
    }, 250);
  };

  const [cancelling, setCancelling] = useState(false);
  const cancelOrder = async () => {
    const ok = await confirm({
      title: t('checkout.cancelDialog.title'),
      message: t('checkout.cancelDialog.message'),
      confirmText: t('checkout.cancelDialog.confirm'),
      cancelText: t('checkout.cancelDialog.keep'),
    });
    if (!ok) return;

    setCancelling(true);
    try {
      if (pendingOrder) await cancelDraft(pendingOrder.order, 'customer_cancelled');
    } catch (err) {
      setCancelling(false);
      if (err.response?.status === 409 && err.response.data?.status === 'paid') {
        // გადახდა უკვე დასრულდა — გაუქმება აღარ შეიძლება
        completeOrder(err.response.data.order);
        toast({ type: 'info', title: t('checkout.toasts.alreadyPaid'), description: t('checkout.toasts.cannotCancel') });
      } else {
        toast({ type: 'error', title: t('checkout.toasts.cancelFailed'), description: t('common.tryAgain') });
      }
      return;
    }
    setPendingOrder(null);
    navigate('/products', { replace: true });
    clearCart();
    toast({ type: 'info', title: t('checkout.toasts.cancelled'), description: t('checkout.toasts.cartCleared') });
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!paymentMethod) {
      setErrors((x) => ({ ...x, paymentMethod: 'checkout.errors.paymentMethod' }));
      return;
    }
    if (paymentMethod === 'card' && !selectedBank) {
      setErrors((x) => ({ ...x, bank: 'checkout.errors.bank' }));
      return;
    }

    // ბარათით: უკვე შექმნილი გადაუხდელი შეკვეთის ხელახალი გამოყენება
    if (paymentMethod === 'card' && reusableOrder) {
      setPaymentOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/order-create', orderPayload());
      if (paymentMethod === 'card') {
        // შეკვეთა მოლოდინშია — გადახდა სრულდება ბანკის გვერდზე, მოდალში
        setPendingOrder({ order: data, signature: orderSignature });
        setPaymentOpen(true);
      } else {
        completeOrder(data);
      }
    } catch (err) {
      const fields = err.response?.data?.fields || {};
      const fieldKeys = Object.fromEntries(Object.keys(fields).map((f) => [f, `checkout.errors.${f}`]));
      if (DELIVERY_FIELDS.some((f) => fields[f])) {
        setErrors(fieldKeys);
        setStep('delivery');
      } else if (fields.bank) {
        setErrors((x) => ({ ...x, bank: 'checkout.errors.bank' }));
      } else if (Object.keys(fields).length) {
        setServerError(t(`checkout.errors.${Object.keys(fields)[0]}`, { defaultValue: t('checkout.errors.orderFailed') }));
      } else {
        setServerError(apiErrorMessage(err, 'checkout.errors.orderFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (placedOrder) {
    return (
      <div className="container page">
        <div className="confirmation-steps">
          <Steps step="done" />
        </div>
        <OrderConfirmation order={placedOrder} banks={options?.banks || []} cities={options?.cities || []} />
      </div>
    );
  }

  // ცარიელი შეკვეთა (მაგ. ბოლო პროდუქტი ამოიღეს) — გადახდის მოქმედებები აღარ ჩანს
  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon="cart" title={t('checkout.emptyTitle')} text={t('checkout.emptyText')}>
          <Link to="/products" className="btn btn-primary">
            {t('cart.continueShopping')} <Icon name="arrowRight" size={18} />
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="container page">
        {optionsError ? <EmptyState icon="alert" title={t('catalog.loadErrorTitle')} text={t('checkout.loadError')} /> : <Loader />}
      </div>
    );
  }

  const fieldProps = (name) => ({
    id: `f-${name}`,
    name,
    value: form[name],
    onChange: onInput,
    className: `input ${errors[name] ? 'is-invalid' : ''}`,
    'aria-invalid': errors[name] ? true : undefined,
  });
  const fieldError = (name) => errors[name] && <span className="field-error">{t(errors[name])}</span>;
  const city = cityLabel(options.cities, form.city);

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label={t('common.breadcrumb')}>
        <Link to="/cart">{t('nav.cart')}</Link>
        <Icon name="chevronRight" size={14} />
        <span className="current">{t('checkout.breadcrumb')}</span>
      </nav>
      <div className="page-header">
        <h1 className="page-title">{t('checkout.title')}</h1>
        <Steps step={step} />
      </div>

      <div className="split">
        {step === 'delivery' ? (
          <form className="form-stack checkout-step" onSubmit={goToPayment} noValidate>
            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">1</span> {t('checkout.recipient')}
              </h2>
              <div className="form-grid">
                <Field label={t('checkout.firstName')} required hint={fieldError('firstName')}>
                  <input {...fieldProps('firstName')} autoComplete="given-name" />
                </Field>
                <Field label={t('checkout.lastName')} required hint={fieldError('lastName')}>
                  <input {...fieldProps('lastName')} autoComplete="family-name" />
                </Field>
                <Field label={t('checkout.phone')} required className="span-2" hint={fieldError('phone')}>
                  <input {...fieldProps('phone')} type="tel" autoComplete="tel" placeholder="5XX XX XX XX" />
                </Field>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">2</span> {t('checkout.address')}
              </h2>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="f-city">
                    {t('checkout.city')}
                    <span className="req">*</span>
                  </label>
                  <CitySelect
                    id="f-city"
                    cities={options.cities}
                    value={form.city}
                    onChange={(v) => setField('city', v)}
                    invalid={Boolean(errors.city)}
                  />
                  {errors.city && <span className="field-hint field-error">{t(errors.city)}</span>}
                </div>
                <Field label={t('checkout.postalCode')}>
                  <input {...fieldProps('postalCode')} autoComplete="postal-code" placeholder={t('checkout.optional')} />
                </Field>
                <Field
                  label={t('checkout.street')}
                  required
                  className="span-2"
                  hint={errors.street ? fieldError('street') : t('checkout.streetHint')}
                >
                  <input {...fieldProps('street')} autoComplete="street-address" placeholder={t('checkout.streetPlaceholder')} />
                </Field>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">3</span> {t('checkout.delivery')}
              </h2>
              <DeliveryInfo method={delivery} />
            </section>

            <button className="btn btn-primary btn-lg checkout-next" type="submit">
              {t('checkout.continueToPayment')} <Icon name="arrowRight" size={18} />
            </button>
          </form>
        ) : (
          <form className="form-stack checkout-step" onSubmit={placeOrder} noValidate>
            <section className="card card-pad review-card">
              <div className="review-row">
                <Icon name="pin" size={20} />
                <div>
                  <strong>
                    {form.firstName} {form.lastName} · {form.phone}
                  </strong>
                  <span>
                    {city}, {form.street}
                    {form.postalCode ? `, ${form.postalCode}` : ''}
                  </span>
                </div>
                <button type="button" className="link" onClick={() => setStep('delivery')}>
                  {t('common.change')}
                </button>
              </div>
              <div className="review-row">
                <Icon name="truck" size={20} />
                <div>
                  <strong>
                    {dText.label} · {t('common.free')}
                  </strong>
                  <span>
                    {dText.estimate} · {dText.coverage}
                  </span>
                </div>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">4</span> {t('checkout.paymentMethod')}
              </h2>
              <div className="pay-methods" role="radiogroup" aria-label={t('checkout.paymentMethod')} aria-invalid={errors.paymentMethod ? true : undefined}>
                {options.paymentMethods.map((m) => {
                  const unavailable = !isMethodAvailable(m);
                  return (
                    <label
                      key={m.id}
                      className={`pay-method ${paymentMethod === m.id ? 'selected' : ''} ${errors.paymentMethod && !unavailable ? 'is-invalid' : ''} ${unavailable ? 'unavailable' : ''}`}
                      title={unavailable ? t('checkout.cardComingSoonHint') : undefined}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.id}
                        checked={paymentMethod === m.id}
                        disabled={unavailable}
                        aria-describedby={unavailable ? `pm-${m.id}-soon` : undefined}
                        onChange={() => {
                          setPaymentMethod(m.id);
                          // კურიერთან გადახდაზე გადასვლისას ბანკის არჩევანი უქმდება
                          if (m.id !== 'card') setBankId('');
                          setErrors((x) => ({ ...x, paymentMethod: undefined, bank: undefined }));
                          setServerError('');
                        }}
                      />
                      <span className="pay-radio" />
                      <span className="pay-method-icon">
                        <Icon name={PAYMENT_ICONS[m.id] || 'card'} size={22} />
                      </span>
                      <span className="pay-method-text">
                        <strong>{paymentLabel(m.id)}</strong>
                        <small id={`pm-${m.id}-soon`}>
                          {unavailable ? t('checkout.availableSoon') : t(`checkout.paymentMethods.${m.id}.description`)}
                        </small>
                      </span>
                      {unavailable && <span className="pill pill-neutral no-dot soon-badge">{t('checkout.soon')}</span>}
                    </label>
                  );
                })}
              </div>
              {errors.paymentMethod && (
                <p className="field-error" style={{ marginTop: 10 }}>
                  {t(errors.paymentMethod)}
                </p>
              )}

              {paymentMethod === 'card' && (
                <div className="bank-select">
                  <div className="bank-select-head">
                    <strong>{t('checkout.chooseBank')}</strong>
                    <span>{t('checkout.bankHint')}</span>
                  </div>
                  <div className="bank-options" role="radiogroup" aria-label={t('checkout.bank')}>
                    {(options.banks || []).map((b) => {
                      const unavailable = !b.mode;
                      return (
                        <label
                          key={b.id}
                          className={`bank-option ${bankId === b.id ? 'selected' : ''} ${unavailable ? 'disabled' : ''} ${errors.bank ? 'is-invalid' : ''}`}
                        >
                          <input
                            type="radio"
                            name="bank"
                            value={b.id}
                            checked={bankId === b.id}
                            disabled={unavailable}
                            onChange={() => {
                              setBankId(b.id);
                              setErrors((x) => ({ ...x, bank: undefined }));
                              setServerError('');
                            }}
                          />
                          <span className="pay-radio" />
                          <span className={`bank-mark bank-${b.id.toLowerCase()}`}>{b.short}</span>
                          <span className="pay-method-text">
                            <strong>{bankName(b)}</strong>
                            <small>
                              {b.latin}
                              {unavailable ? ` · ${t('checkout.temporarilyUnavailable')}` : ''}
                            </small>
                          </span>
                          {b.mode === 'sandbox' && <span className="pill pill-warning no-dot bank-test">{t('checkout.test')}</span>}
                        </label>
                      );
                    })}
                  </div>
                  {errors.bank && <p className="field-error">{t(errors.bank)}</p>}
                </div>
              )}

              {paymentMethod === 'cod' && (
                <div className="cod-note">
                  <Icon name="info" size={18} />
                  <span>{t('checkout.codNote')}</span>
                </div>
              )}
            </section>

            {serverError && <Alert>{serverError}</Alert>}

            <div className="checkout-actions">
              <button type="button" className="btn btn-lg" onClick={() => setStep('delivery')} disabled={submitting}>
                <Icon name="arrowLeft" size={18} /> {t('common.back')}
              </button>
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={submitting || (paymentMethod === 'card' && !selectedBank)}
                title={paymentMethod === 'card' && !selectedBank ? t('checkout.chooseBankFirst') : undefined}
              >
                {submitting ? (
                  <>
                    <span className="spinner" /> {paymentMethod === 'card' ? t('checkout.preparingPayment') : t('common.sending')}
                  </>
                ) : paymentMethod === 'card' ? (
                  <>
                    <Icon name="lock" size={18} /> {t('checkout.payAmount', { amount: formatPrice(payableTotal) })}
                  </>
                ) : (
                  <>
                    <Icon name="check" size={18} /> {t('checkout.confirmOrder')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        <aside className="card card-pad summary">
          <h2 className="card-title">{t('cart.summary')}</h2>
          <div className="mini-items">
            {items.map((i) => {
              const name = L(i, 'name');
              return (
                <div className={`mini-item removable ${removingId === i.lineId ? 'removing' : ''}`} key={i.lineId}>
                  <div className="img">
                    <img src={i.image || 'https://placehold.co/60x60'} alt="" />
                    <span className="qty">{i.quantity}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <span className="name">{name}</span>
                    <LineOptions options={i.options} />
                    <span className="unit">
                      {i.quantity} × {formatPrice(i.price)}
                      {i.oldPrice && <s>{formatPrice(i.oldPrice)}</s>}
                    </span>
                  </div>
                  <strong>{formatPrice(i.price * i.quantity)}</strong>
                  <button
                    type="button"
                    className="mini-remove"
                    onClick={() => removeItem(i.lineId)}
                    disabled={submitting || cancelling || Boolean(removingId)}
                    aria-label={t('checkout.removeItem', { name })}
                    title={t('checkout.remove')}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="summary-row">
            <span>{t('cart.items', { count: totalItems })}</span>
            <strong>{formatPrice(originalTotal)}</strong>
          </div>
          {discountTotal > 0 && (
            <div className="summary-row discount">
              <span>{t('checkout.discount')}</span>
              <strong>−{formatPrice(discountTotal)}</strong>
            </div>
          )}
          <div className="summary-row">
            <span>{t('cart.delivery')}</span>
            <strong className="free">{deliveryCost > 0 ? formatPrice(deliveryCost) : t('common.free')}</strong>
          </div>
          <div className="summary-total">
            <span>{t('checkout.totalToPay')}</span>
            <strong>{formatPrice(grandTotal)}</strong>
          </div>

          <dl className="summary-details">
            <div>
              <dt>{t('checkout.city')}</dt>
              <dd>{city || '—'}</dd>
            </div>
            <div>
              <dt>{t('checkout.street')}</dt>
              <dd>{form.street.trim() || '—'}</dd>
            </div>
            <div>
              <dt>{t('checkout.delivery')}</dt>
              <dd>{dText.label}</dd>
            </div>
            <div>
              <dt>{t('checkout.estimatedTime')}</dt>
              <dd>{dText.estimate}</dd>
            </div>
            <div>
              <dt>{t('checkout.payment')}</dt>
              <dd>
                {paymentMethod ? paymentLabel(paymentMethod) : '—'}
                {paymentMethod === 'card' && selectedBank ? ` · ${bankName(selectedBank)}` : ''}
              </dd>
            </div>
          </dl>

          <p className="summary-note">
            <Icon name="shield" size={14} /> {t('checkout.cardSecurityNote')}
          </p>

          <button type="button" className="cancel-order-btn" onClick={cancelOrder} disabled={submitting || cancelling}>
            {cancelling ? <span className="spinner" /> : <Icon name="x" size={16} />}
            {t('checkout.cancelOrder')}
          </button>
        </aside>
      </div>

      {paymentOpen && reusableOrder && selectedBank && (
        <PaymentModal order={reusableOrder} bank={selectedBank} onClose={closePayment} onPaid={completeOrder} />
      )}
    </div>
  );
};

export default Checkout;
