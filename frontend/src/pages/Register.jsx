import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import api from '../api/axios';
import Icon from '../components/Icon';
import { Alert, Field, IconInput, PasswordInput } from '../components/ui';

const passwordRules = [
  { test: (p) => p.length >= 8, label: 'მინ. 8 სიმბოლო' },
  { test: (p) => /[A-Z]/.test(p), label: 'დიდი ასო' },
  { test: (p) => /[a-z]/.test(p), label: 'პატარა ასო' },
  { test: (p) => /\d/.test(p), label: 'ციფრი' },
];

// სერვერი აბრუნებს ზუსტ მნიშვნელობებს; ეს მხოლოდ სარეზერვოა, თუ პასუხში არ არის
const DEFAULT_RESEND_SECONDS = 30;
const DEFAULT_VALIDITY_SECONDS = 180;

const secondsLeft = (at, now) => Math.max(0, Math.ceil((at - now) / 1000));
const formatClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ყოველ წამში ხელახალი რენდერი (მხოლოდ მაშინ, როცა ტაიმერი საჭიროა); დრო თავად რენდერში იკითხება
const useSecondTicker = (active) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

// გვერდის განახლებისას მხოლოდ ელ. ფოსტა ინახება (კოდი — არასდროს); ტაიმერები სერვერიდან აღდგება
const PENDING_EMAIL_KEY = 'register:pendingEmail';
const storage = {
  get: () => {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (email) => {
    try {
      sessionStorage.setItem(PENDING_EMAIL_KEY, email);
    } catch {
      /* private mode — refresh-ის აღდგენა უბრალოდ არ იმუშავებს */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      /* ignore */
    }
  },
};

const Register = () => {
  const { register: authRegister } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    street: '',
    email: '',
    password: '',
    code: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(null); // null | 'initial' | 'resend' — დუბლირებული მოთხოვნების თავიდან ასაცილებლად
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ტაიმერები სერვერის პასუხიდან (წამები → ლოკალური დრო); სერვერი რჩება ჭეშმარიტების წყაროდ
  const [timers, setTimers] = useState({ resendAt: 0, expiresAt: 0, validitySeconds: 180 });
  const now = Date.now();
  useSecondTicker(!emailVerified && (otpSent || timers.resendAt > now));

  const resendIn = secondsLeft(timers.resendAt, now);
  const expiresIn = secondsLeft(timers.expiresAt, now);
  const codeExpired = otpSent && expiresIn === 0;

  const applyTimers = (data) => {
    const t = Date.now();
    setTimers((prev) => ({
      resendAt: t + (data.resendAvailableInSeconds || 0) * 1000,
      expiresAt: data.expiresInSeconds !== undefined ? t + data.expiresInSeconds * 1000 : prev.expiresAt,
      validitySeconds: data.codeValiditySeconds || prev.validitySeconds,
    }));
  };

  const resetVerification = () => {
    setOtpSent(false);
    setTimers((t) => ({ ...t, resendAt: 0, expiresAt: 0 }));
    storage.clear();
  };

  // გვერდის განახლების შემდეგ — აქტიური კოდის და ლოდინის დროის აღდგენა სერვერიდან
  useEffect(() => {
    const email = storage.get();
    if (!email) return;
    setForm((f) => ({ ...f, email }));
    api
      .get('/auth-verification-code-status', { params: { email } })
      .then(({ data }) => {
        if (data.active || data.resendAvailableInSeconds > 0) {
          applyTimers(data);
          setOtpSent(true);
        } else storage.clear();
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    // სხვა მისამართზე გადასვლისას წინა ვერიფიკაციის მდგომარეობა უქმდება
    if (e.target.name === 'email' && otpSent) {
      resetVerification();
      setForm({ ...form, email: e.target.value, code: '' });
      return;
    }
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const rulesMet = passwordRules.filter((r) => r.test(form.password)).length;
  const score = form.password ? (rulesMet === 4 ? 3 : rulesMet >= 3 ? 2 : 1) : 0;

  const handleSendOtp = async () => {
    if (!form.email) {
      setError('გთხოვთ, ჯერ შეიყვანოთ ელ. ფოსტა');
      return;
    }
    if (sendingOtp || resendIn > 0) return;
    const isResend = otpSent;
    setError('');
    setSuccess('');
    setSendingOtp(isResend ? 'resend' : 'initial');
    try {
      // პასუხი მოდის მხოლოდ მას შემდეგ, რაც წერილი მიღებულია SMTP სერვერის მიერ
      const { data } = await api.post('/auth-verification-code-send', { email: form.email });
      // სერვერის მნიშვნელობები; თუ (ძველი) სერვერი არ აბრუნებს — ნაგულისხმევი 30 წმ / 3 წთ
      applyTimers({
        resendAvailableInSeconds: data?.resendAvailableInSeconds ?? DEFAULT_RESEND_SECONDS,
        expiresInSeconds: data?.expiresInSeconds ?? DEFAULT_VALIDITY_SECONDS,
        codeValiditySeconds: data?.codeValiditySeconds ?? DEFAULT_VALIDITY_SECONDS,
      });
      setOtpSent(true);
      setForm((f) => ({ ...f, code: '' }));
      storage.set(form.email.trim().toLowerCase());
      toast({
        type: 'success',
        title: isResend ? 'ახალი კოდი გაიგზავნა' : 'ვერიფიკაციის კოდი წარმატებით გაიგზავნა',
        description: isResend ? 'ახალი ვერიფიკაციის კოდი გაიგზავნა თქვენს ელ. ფოსტაზე' : undefined,
      });
    } catch (err) {
      const res = err.response?.data;
      // ლოდინის დრო ჯერ არ გასულა — ტაიმერი სერვერის მონაცემით სინქრონიზდება, კოდი არ იცვლება
      if (err.response?.status === 429) {
        const wait = Number(res?.resendAvailableInSeconds || err.response.headers?.['retry-after']) || DEFAULT_RESEND_SECONDS;
        applyTimers({ resendAvailableInSeconds: wait });
      }
      setError(res?.message || 'კოდის გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSendingOtp(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (!form.code) {
      setError('გთხოვთ, შეიყვანოთ 4-ნიშნა კოდი');
      return;
    }
    setError('');
    setVerifyingOtp(true);
    try {
      await api.post('/auth-verification-code-verify', { email: form.email, code: form.code });
      setEmailVerified(true);
      storage.clear();
      setSuccess('ელ. ფოსტა წარმატებით დადასტურდა!');
    } catch (err) {
      const res = err.response?.data;
      if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'CODE_NOT_FOUND'].includes(res?.code)) setForm((f) => ({ ...f, code: '' }));
      // ვადაგასვლას პანელის გაფრთხილება აჩვენებს (ახალი კოდის ღილაკთან ერთად) — ზედა შეცდომა აღარ დუბლირდება
      if (res?.code === 'CODE_EXPIRED') setTimers((t) => ({ ...t, expiresAt: 0 }));
      else setError(res?.message || 'კოდის შემოწმება ვერ მოხერხდა');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!emailVerified) {
      setError('რეგისტრაციისთვის აუცილებელია ელ. ფოსტის ვერიფიკაცია');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს, ერთ დიდ ასოს და ერთ ციფრს');
      return;
    }

    setSubmitting(true);
    try {
      await authRegister(form);
      toast({ title: 'ანგარიში შეიქმნა!', description: 'კეთილი იყოს თქვენი მობრძანება' });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      // ვერიფიკაციის ვადა (30 წთ) ამოიწურა — ელ. ფოსტა თავიდან უნდა დადასტურდეს
      if (err.response?.data?.code === 'VERIFICATION_REQUIRED') {
        setEmailVerified(false);
        resetVerification();
        setForm((f) => ({ ...f, code: '' }));
      }
      setError(err.response?.data?.message || 'რეგისტრაცია ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <form className="card auth-card wide" onSubmit={handleSubmit}>
        <div className="auth-head">
          <div className="brand-mark">
            <Icon name="sparkle" size={22} />
          </div>
          <h1>ანგარიშის შექმნა</h1>
          <p>დარეგისტრირდით და მიიღეთ ექსკლუზიური შეთავაზებები</p>
        </div>

        <div className="steps" aria-hidden="true">
          <div className={`step ${emailVerified ? 'done' : 'active'}`}>
            <span className="dot">{emailVerified ? <Icon name="check" size={14} strokeWidth={3} /> : 1}</span>
            ელ. ფოსტა
          </div>
          <div className={`line ${emailVerified ? 'done' : ''}`} />
          <div className={`step ${emailVerified ? 'active' : ''}`}>
            <span className="dot">2</span>
            მონაცემები
          </div>
        </div>

        <div className="form-stack">
          <Alert>{error}</Alert>
          {!error && <Alert type="success">{success}</Alert>}

          <Field label="ელ. ფოსტა" required>
            <div className="input-row">
              <div>
                <IconInput
                  icon="mail"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  disabled={emailVerified || submitting}
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              </div>
              {emailVerified ? (
                <span className="verified-badge">
                  <Icon name="check" size={16} strokeWidth={3} /> დადასტურდა
                </span>
              ) : (
                !otpSent && (
                  <button
                    type="button"
                    className="btn"
                    style={{ height: 46 }}
                    onClick={handleSendOtp}
                    disabled={Boolean(sendingOtp) || !form.email || submitting || resendIn > 0}
                  >
                    {sendingOtp === 'initial' ? (
                      <>
                        <span className="spinner" /> იგზავნება...
                      </>
                    ) : resendIn > 0 ? (
                      <span className="otp-timer">{formatClock(resendIn)}</span>
                    ) : (
                      'კოდის გაგზავნა'
                    )}
                  </button>
                )
              )}
            </div>
          </Field>

          {otpSent && !emailVerified && (
            <div className="otp-panel">
              {codeExpired ? (
                <Alert type="warning">ვერიფიკაციის კოდის ვადა ამოიწურა. გთხოვთ, მოითხოვოთ ახალი კოდი.</Alert>
              ) : (
                <Alert type="info">
                  ვერიფიკაციის კოდი გაიგზავნა თქვენს ელ. ფოსტაზე. კოდის მოქმედების ვადა:{' '}
                  {Math.round(timers.validitySeconds / 60)} წუთი
                  {expiresIn > 0 && (
                    <>
                      {' '}
                      · დარჩა <span className="otp-timer">{formatClock(expiresIn)}</span>
                    </>
                  )}
                </Alert>
              )}

              <Field label="ვერიფიკაციის კოდი" required hint="შეამოწმეთ ელ. ფოსტა (მათ შორის Spam საქაღალდე)">
                <div className="input-row">
                  <input
                    className="input otp-input"
                    type="text"
                    inputMode="numeric"
                    name="code"
                    placeholder="••••"
                    maxLength="4"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                    disabled={submitting || codeExpired}
                    autoFocus
                    autoComplete="one-time-code"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: 46 }}
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || form.code.length < 4 || submitting || codeExpired}
                  >
                    {verifyingOtp ? <span className="spinner" /> : 'დადასტურება'}
                  </button>
                </div>
              </Field>

              <div className="otp-resend">
                <span id="otp-resend-status">
                  {resendIn > 0 ? (
                    <>
                      კოდის ხელახლა მოთხოვნა შესაძლებელია <span className="otp-timer">{formatClock(resendIn)}</span>-ში
                    </>
                  ) : (
                    'არ მიგიღიათ კოდი?'
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleSendOtp}
                  disabled={resendIn > 0 || Boolean(sendingOtp) || submitting}
                  aria-describedby="otp-resend-status"
                  title={resendIn > 0 ? `ხელმისაწვდომი იქნება ${formatClock(resendIn)}-ში` : undefined}
                >
                  {sendingOtp === 'resend' ? (
                    <>
                      <span className="spinner" /> იგზავნება...
                    </>
                  ) : (
                    <>
                      <Icon name="refresh" size={14} /> კოდის ხელახლა მოთხოვნა
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="form-grid">
            <Field label="სახელი" required>
              <input className="input" name="firstName" value={form.firstName} onChange={handleChange} required disabled={submitting} autoComplete="given-name" />
            </Field>
            <Field label="გვარი">
              <input className="input" name="lastName" value={form.lastName} onChange={handleChange} disabled={submitting} autoComplete="family-name" />
            </Field>
            <Field label="ტელეფონი">
              <input className="input" name="phone" type="tel" value={form.phone} onChange={handleChange} disabled={submitting} autoComplete="tel" />
            </Field>
            <Field label="ქალაქი">
              <input className="input" name="city" value={form.city} onChange={handleChange} disabled={submitting} autoComplete="address-level2" />
            </Field>
            <Field label="მისამართი (ქუჩა, ნომერი)" className="span-2">
              <input className="input" name="street" value={form.street} onChange={handleChange} disabled={submitting} autoComplete="street-address" />
            </Field>
          </div>

          <Field label="პაროლი" required>
            <PasswordInput name="password" value={form.password} onChange={handleChange} required disabled={submitting} autoComplete="new-password" />
            <div className="pw-meter" data-score={score}>
              <span />
              <span />
              <span />
            </div>
            <div className="pw-rules">
              {passwordRules.map((r) => {
                const ok = r.test(form.password);
                return (
                  <span key={r.label} className={`pw-rule ${ok ? 'ok' : ''}`}>
                    <span className="tick">
                      <Icon name="check" size={10} strokeWidth={4} />
                    </span>
                    {r.label}
                  </span>
                );
              })}
            </div>
          </Field>

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!emailVerified || submitting}>
            {submitting ? (
              <>
                <span className="spinner" /> რეგისტრაცია...
              </>
            ) : (
              'რეგისტრაცია'
            )}
          </button>
          {!emailVerified && <p className="field-hint" style={{ textAlign: 'center', marginTop: -6 }}>რეგისტრაციისთვის ჯერ დაადასტურეთ ელ. ფოსტა</p>}
        </div>

        <p className="auth-foot">
          უკვე გაქვთ ანგარიში?{' '}
          <Link to="/login" state={location.state} className="link">
            შესვლა
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
