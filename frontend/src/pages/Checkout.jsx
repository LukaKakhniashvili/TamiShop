import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UIContext';
import Icon from '../components/Icon';
import { Alert, EmptyState, Field, Loader, formatPrice } from '../components/ui';
import CitySelect from '../components/checkout/CitySelect';
import OrderConfirmation from '../components/checkout/OrderConfirmation';
import PaymentModal from '../components/checkout/PaymentModal';

const DELIVERY_FIELDS = ['firstName', 'lastName', 'phone', 'city', 'street'];

// კლიენტის ვალიდაცია — იგივე წესები, რასაც სერვერი ამოწმებს (backend/controllers/orderController.js)
const validateDelivery = (form, cityNames) => {
  const e = {};
  if (!form.firstName.trim()) e.firstName = 'შეიყვანეთ სახელი';
  if (!form.lastName.trim()) e.lastName = 'შეიყვანეთ გვარი';
  if (!/^[+\d][\d\s-]{7,}$/.test(form.phone.trim())) e.phone = 'შეიყვანეთ სწორი ტელეფონის ნომერი';
  if (!cityNames.has(form.city)) e.city = 'აირჩიეთ ქალაქი';
  if (form.street.trim().length < 5) e.street = 'მიუთითეთ სრული მისამართი (ქუჩა, სახლი, ბინა)';
  return e;
};

const Steps = ({ step }) => {
  const steps = [
    { id: 'delivery', label: 'მიწოდება' },
    { id: 'payment', label: 'გადახდა' },
    { id: 'done', label: 'დადასტურება' },
  ];
  const current = steps.findIndex((s) => s.id === step);
  return (
    <div className="steps checkout-steps" aria-label="შეკვეთის ეტაპები">
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

const DeliveryInfo = ({ method }) =>
  method ? (
    <div className="delivery-info">
      <div className="delivery-info-head">
        <span className="delivery-info-icon">
          <Icon name="truck" size={22} />
        </span>
        <div>
          <strong>მიწოდება უფასოა მთელ საქართველოში</strong>
          <span>{method.label} · {method.estimate}</span>
        </div>
        <span className="pill pill-success no-dot">უფასო</span>
      </div>
      <dl className="delivery-info-grid">
        <div>
          <dt>მიწოდების ტიპი</dt>
          <dd>სტანდარტული</dd>
        </div>
        <div>
          <dt>ღირებულება</dt>
          <dd className="free">{method.cost > 0 ? formatPrice(method.cost) : 'უფასო'}</dd>
        </div>
        <div>
          <dt>სავარაუდო ვადა</dt>
          <dd>{method.estimate}</dd>
        </div>
        <div>
          <dt>დაფარვა</dt>
          <dd>{method.coverage}</dd>
        </div>
      </dl>
    </div>
  ) : null;

const PAYMENT_ICONS = { card: 'card', cod: 'truck' };

// ბარათით გადახდა აქტიურია მხოლოდ მაშინ, როცა სერვერი პირდაპირ ადასტურებს (enabled: true, CARD_PAYMENTS_ENABLED);
// დანარჩენი მეთოდები — თუ სერვერი არ გამორთავს. ძველი/უცნობი პასუხის დროს ბარათი გამორთული რჩება.
const isMethodAvailable = (m) => (m.id === 'card' ? m.enabled === true : m.enabled !== false);

const Checkout = () => {
  const { items, totalPrice, totalItems, clearCart, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

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
  const [errors, setErrors] = useState({});
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
  const paymentLabel = options?.paymentMethods.find((p) => p.id === paymentMethod)?.label;

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
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
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
  const removeItem = (productId) => {
    if (submitting || paymentOpen || removingId) return;
    setRemovingId(productId);
    setTimeout(() => {
      removeFromCart(productId);
      setRemovingId(null);
    }, 250);
  };

  const [cancelling, setCancelling] = useState(false);
  const cancelOrder = async () => {
    const ok = await confirm({
      title: 'შეკვეთის გაუქმება?',
      message: 'ნამდვილად გსურთ ამ შეკვეთის გაუქმება? მიმდინარე შეკვეთიდან ყველა პროდუქტი წაიშლება.',
      confirmText: 'დიახ, გაუქმება',
      cancelText: 'შეკვეთის შენარჩუნება',
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
        toast({ type: 'info', title: 'შეკვეთა უკვე გადახდილია', description: 'გაუქმება შეუძლებელია' });
      } else {
        toast({ type: 'error', title: 'გაუქმება ვერ მოხერხდა', description: 'სცადეთ თავიდან' });
      }
      return;
    }
    setPendingOrder(null);
    navigate('/products', { replace: true });
    clearCart();
    toast({ type: 'info', title: 'შეკვეთა გაუქმდა', description: 'კალათა გასუფთავდა' });
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!paymentMethod) {
      setErrors((x) => ({ ...x, paymentMethod: 'აირჩიეთ გადახდის მეთოდი' }));
      return;
    }
    if (paymentMethod === 'card' && !selectedBank) {
      setErrors((x) => ({ ...x, bank: 'აირჩიეთ ბანკი' }));
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
      const message = err.response?.data?.message || 'შეკვეთის გაფორმება ვერ მოხერხდა';
      if (DELIVERY_FIELDS.some((f) => fields[f])) {
        setErrors(fields);
        setStep('delivery');
      } else if (fields.bank) {
        setErrors((x) => ({ ...x, bank: fields.bank }));
      } else {
        setServerError(message);
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
        <OrderConfirmation
          order={placedOrder}
          paymentMethods={options?.paymentMethods || []}
          banks={options?.banks || []}
        />
      </div>
    );
  }

  // ცარიელი შეკვეთა (მაგ. ბოლო პროდუქტი ამოიღეს) — გადახდის მოქმედებები აღარ ჩანს
  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState
          icon="cart"
          title="შეკვეთაში პროდუქტები აღარ არის"
          text="შეკვეთის გასაფორმებლად დაამატეთ პროდუქტები კალათაში."
        >
          <Link to="/products" className="btn btn-primary">
            ყიდვის გაგრძელება <Icon name="arrowRight" size={18} />
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="container page">
        {optionsError ? (
          <EmptyState icon="alert" title="ვერ ჩაიტვირთა" text="შეკვეთის გაფორმების გვერდი ვერ ჩაიტვირთა. სცადეთ გვერდის განახლება." />
        ) : (
          <Loader />
        )}
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

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link to="/cart">კალათა</Link>
        <Icon name="chevronRight" size={14} />
        <span className="current">გაფორმება</span>
      </nav>
      <div className="page-header">
        <h1 className="page-title">შეკვეთის გაფორმება</h1>
        <Steps step={step} />
      </div>

      <div className="split">
        {step === 'delivery' ? (
          <form className="form-stack checkout-step" onSubmit={goToPayment} noValidate>
            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">1</span> მიმღები
              </h2>
              <div className="form-grid">
                <Field label="სახელი" required hint={errors.firstName && <span className="field-error">{errors.firstName}</span>}>
                  <input {...fieldProps('firstName')} autoComplete="given-name" />
                </Field>
                <Field label="გვარი" required hint={errors.lastName && <span className="field-error">{errors.lastName}</span>}>
                  <input {...fieldProps('lastName')} autoComplete="family-name" />
                </Field>
                <Field label="ტელეფონის ნომერი" required className="span-2" hint={errors.phone && <span className="field-error">{errors.phone}</span>}>
                  <input {...fieldProps('phone')} type="tel" autoComplete="tel" placeholder="5XX XX XX XX" />
                </Field>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">2</span> მიწოდების მისამართი
              </h2>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="f-city">
                    ქალაქი<span className="req">*</span>
                  </label>
                  <CitySelect
                    id="f-city"
                    cities={options.cities}
                    value={form.city}
                    onChange={(v) => setField('city', v)}
                    invalid={Boolean(errors.city)}
                  />
                  {errors.city && <span className="field-hint field-error">{errors.city}</span>}
                </div>
                <Field label="საფოსტო ინდექსი">
                  <input {...fieldProps('postalCode')} autoComplete="postal-code" placeholder="არასავალდებულო" />
                </Field>
                <Field
                  label="მისამართი"
                  required
                  className="span-2"
                  hint={errors.street ? <span className="field-error">{errors.street}</span> : 'ქუჩა, სახლის ნომერი, ბინა, სადარბაზო, სართული'}
                >
                  <input {...fieldProps('street')} autoComplete="street-address" placeholder="მაგ. რუსთაველის გამზ. 25, ბინა 12" />
                </Field>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">3</span> მიწოდება
              </h2>
              <DeliveryInfo method={delivery} />
            </section>

            <button className="btn btn-primary btn-lg checkout-next" type="submit">
              გაგრძელება გადახდაზე <Icon name="arrowRight" size={18} />
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
                    {form.city}, {form.street}
                    {form.postalCode ? `, ${form.postalCode}` : ''}
                  </span>
                </div>
                <button type="button" className="link" onClick={() => setStep('delivery')}>
                  შეცვლა
                </button>
              </div>
              <div className="review-row">
                <Icon name="truck" size={20} />
                <div>
                  <strong>{delivery?.label} · უფასო</strong>
                  <span>{delivery?.estimate} · {delivery?.coverage}</span>
                </div>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">
                <span className="num">4</span> გადახდის მეთოდი
              </h2>
              <div className="pay-methods" role="radiogroup" aria-label="გადახდის მეთოდი" aria-invalid={errors.paymentMethod ? true : undefined}>
                {options.paymentMethods.map((m) => {
                  const unavailable = !isMethodAvailable(m);
                  return (
                  <label
                    key={m.id}
                    className={`pay-method ${paymentMethod === m.id ? 'selected' : ''} ${errors.paymentMethod && !unavailable ? 'is-invalid' : ''} ${unavailable ? 'unavailable' : ''}`}
                    title={unavailable ? 'ბარათით გადახდა მალე იქნება ხელმისაწვდომი' : undefined}
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
                      <strong>{m.label}</strong>
                      <small id={`pm-${m.id}-soon`}>
                        {unavailable ? 'მალე იქნება ხელმისაწვდომი' : m.description}
                      </small>
                    </span>
                    {unavailable && <span className="pill pill-neutral no-dot soon-badge">მალე</span>}
                  </label>
                  );
                })}
              </div>
              {errors.paymentMethod && <p className="field-error" style={{ marginTop: 10 }}>{errors.paymentMethod}</p>}

              {paymentMethod === 'card' && (
                <div className="bank-select">
                  <div className="bank-select-head">
                    <strong>აირჩიეთ ბანკი</strong>
                    <span>ბარათის მონაცემებს შეიყვანთ ბანკის დაცულ გვერდზე</span>
                  </div>
                  <div className="bank-options" role="radiogroup" aria-label="ბანკი">
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
                            <strong>{b.name}</strong>
                            <small>
                              {b.latin}
                              {unavailable ? ' · დროებით მიუწვდომელია' : ''}
                            </small>
                          </span>
                          {b.mode === 'sandbox' && <span className="pill pill-warning no-dot bank-test">ტესტი</span>}
                        </label>
                      );
                    })}
                  </div>
                  {errors.bank && <p className="field-error">{errors.bank}</p>}
                </div>
              )}

              {paymentMethod === 'cod' && (
                <div className="cod-note">
                  <Icon name="info" size={18} />
                  <span>
                    გადაიხდით კურიერთან, შეკვეთის მიღებისას. ბარათის მონაცემები საჭირო არ არის.
                  </span>
                </div>
              )}
            </section>

            {serverError && <Alert>{serverError}</Alert>}

            <div className="checkout-actions">
              <button type="button" className="btn btn-lg" onClick={() => setStep('delivery')} disabled={submitting}>
                <Icon name="arrowLeft" size={18} /> უკან
              </button>
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={submitting || (paymentMethod === 'card' && !selectedBank)}
                title={paymentMethod === 'card' && !selectedBank ? 'ჯერ აირჩიეთ ბანკი' : undefined}
              >
                {submitting ? (
                  <>
                    <span className="spinner" /> {paymentMethod === 'card' ? 'მზადდება გადახდა...' : 'იგზავნება...'}
                  </>
                ) : paymentMethod === 'card' ? (
                  <>
                    <Icon name="lock" size={18} /> გადახდა · {formatPrice(payableTotal)}
                  </>
                ) : (
                  <>
                    <Icon name="check" size={18} /> შეკვეთის დადასტურება
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        <aside className="card card-pad summary">
          <h2 className="card-title">შეკვეთის შეჯამება</h2>
          <div className="mini-items">
            {items.map((i) => (
              <div className={`mini-item removable ${removingId === i.productId ? 'removing' : ''}`} key={i.productId}>
                <div className="img">
                  <img src={i.image || 'https://placehold.co/60x60'} alt="" />
                  <span className="qty">{i.quantity}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span className="name">{i.name}</span>
                  <span className="unit">
                    {i.quantity} × {formatPrice(i.price)}
                    {i.oldPrice && <s>{formatPrice(i.oldPrice)}</s>}
                  </span>
                </div>
                <strong>{formatPrice(i.price * i.quantity)}</strong>
                <button
                  type="button"
                  className="mini-remove"
                  onClick={() => removeItem(i.productId)}
                  disabled={submitting || cancelling || Boolean(removingId)}
                  aria-label={`${i.name} — შეკვეთიდან ამოღება`}
                  title="ამოღება"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="summary-row">
            <span>ნივთები ({totalItems})</span>
            <strong>{formatPrice(originalTotal)}</strong>
          </div>
          {discountTotal > 0 && (
            <div className="summary-row discount">
              <span>ფასდაკლება</span>
              <strong>−{formatPrice(discountTotal)}</strong>
            </div>
          )}
          <div className="summary-row">
            <span>მიწოდება</span>
            <strong className="free">{deliveryCost > 0 ? formatPrice(deliveryCost) : 'უფასო'}</strong>
          </div>
          <div className="summary-total">
            <span>სულ გადასახდელი</span>
            <strong>{formatPrice(grandTotal)}</strong>
          </div>

          <dl className="summary-details">
            <div>
              <dt>ქალაქი</dt>
              <dd>{form.city || '—'}</dd>
            </div>
            <div>
              <dt>მისამართი</dt>
              <dd>{form.street.trim() || '—'}</dd>
            </div>
            <div>
              <dt>მიწოდება</dt>
              <dd>{delivery?.label}</dd>
            </div>
            <div>
              <dt>სავარაუდო ვადა</dt>
              <dd>{delivery?.estimate}</dd>
            </div>
            <div>
              <dt>გადახდა</dt>
              <dd>
                {paymentLabel || '—'}
                {paymentMethod === 'card' && selectedBank ? ` · ${selectedBank.name}` : ''}
              </dd>
            </div>
          </dl>

          <p className="summary-note">
            <Icon name="shield" size={14} /> ბარათის მონაცემებს მხოლოდ ბანკი ამუშავებს
          </p>

          <button
            type="button"
            className="cancel-order-btn"
            onClick={cancelOrder}
            disabled={submitting || cancelling}
          >
            {cancelling ? <span className="spinner" /> : <Icon name="x" size={16} />}
            შეკვეთის გაუქმება
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
