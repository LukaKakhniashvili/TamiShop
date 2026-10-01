import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import api from '../api/axios';
import Icon from '../components/Icon';
import PasswordRules from '../components/PasswordRules';
import VerificationCodePanel from '../components/VerificationCodePanel';
import { Alert, Field, IconInput, PasswordInput } from '../components/ui';
import useVerificationCode, { formatClock } from '../hooks/useVerificationCode';
import { validatePassword } from '../utils/passwordPolicy';

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
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // კოდის ნაკადი (ტაიმერები, ხელახლა გაგზავნა, refresh-ის აღდგენა) — საერთოა პაროლის აღდგენასთან
  const vc = useVerificationCode({
    sendUrl: '/auth-verification-code-send',
    statusUrl: '/auth-verification-code-status',
    storageKey: 'register:pendingEmail',
    done: emailVerified,
    onRestore: (email) => setForm((f) => ({ ...f, email })),
  });

  const handleChange = (e) => {
    // სხვა მისამართზე გადასვლისას წინა ვერიფიკაციის მდგომარეობა უქმდება
    if (e.target.name === 'email' && vc.codeSent) {
      vc.reset();
      setForm({ ...form, email: e.target.value, code: '' });
      return;
    }
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSendOtp = async () => {
    if (!form.email) {
      setError('გთხოვთ, ჯერ შეიყვანოთ ელ. ფოსტა');
      return;
    }
    setError('');
    setSuccess('');
    const r = await vc.send(form.email);
    if (r.skipped) return;
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setForm((f) => ({ ...f, code: '' }));
    toast({
      type: 'success',
      title: r.isResend ? 'ახალი კოდი გაიგზავნა' : 'ვერიფიკაციის კოდი წარმატებით გაიგზავნა',
      description: r.isResend ? 'ახალი ვერიფიკაციის კოდი გაიგზავნა თქვენს ელ. ფოსტაზე' : undefined,
    });
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
      vc.clearStorage();
      setSuccess('ელ. ფოსტა წარმატებით დადასტურდა!');
    } catch (err) {
      const res = err.response?.data;
      if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'CODE_NOT_FOUND'].includes(res?.code)) setForm((f) => ({ ...f, code: '' }));
      // ვადაგასვლას პანელის გაფრთხილება აჩვენებს (ახალი კოდის ღილაკთან ერთად) — ზედა შეცდომა აღარ დუბლირდება
      if (res?.code === 'CODE_EXPIRED') vc.markExpired();
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

    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
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
        vc.reset();
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
                !vc.codeSent && (
                  <button
                    type="button"
                    className="btn"
                    style={{ height: 46 }}
                    onClick={handleSendOtp}
                    disabled={Boolean(vc.sending) || !form.email || submitting || vc.resendIn > 0}
                  >
                    {vc.sending === 'initial' ? (
                      <>
                        <span className="spinner" /> იგზავნება...
                      </>
                    ) : vc.resendIn > 0 ? (
                      <span className="otp-timer">{formatClock(vc.resendIn)}</span>
                    ) : (
                      'კოდის გაგზავნა'
                    )}
                  </button>
                )
              )}
            </div>
          </Field>

          {vc.codeSent && !emailVerified && (
            <VerificationCodePanel
              vc={vc}
              code={form.code}
              onCodeChange={(code) => setForm((f) => ({ ...f, code }))}
              onVerify={handleVerifyOtp}
              onResend={handleSendOtp}
              verifying={verifyingOtp}
              disabled={submitting}
            />
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
            <PasswordRules password={form.password} />
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
