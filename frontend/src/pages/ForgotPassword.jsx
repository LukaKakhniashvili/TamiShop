import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/UIContext';
import Icon from '../components/Icon';
import PasswordRules from '../components/PasswordRules';
import VerificationCodePanel from '../components/VerificationCodePanel';
import { Alert, Field, IconInput, PasswordInput } from '../components/ui';
import useVerificationCode from '../hooks/useVerificationCode';
import { PASSWORDS_MISMATCH_MESSAGE, validatePassword } from '../utils/passwordPolicy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REDIRECT_SECONDS = 4;

const STEPS = [
  { id: 'email', label: 'ელ. ფოსტა' },
  { id: 'code', label: 'კოდი' },
  { id: 'password', label: 'ახალი პაროლი' },
];

const Steps = ({ step }) => {
  const current = step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === step);
  return (
    <div className="steps recovery-steps" aria-label="აღდგენის ეტაპები">
      {STEPS.map((s, i) => (
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

/**
 * პაროლის აღდგენა: ელ. ფოსტა → კოდი (3 წთ ვადა, 30 წმ ხელახლა გაგზავნა) → ახალი პაროლი → შესვლა.
 * კოდის დადასტურების შემდეგ სერვერი აბრუნებს ერთჯერად reset token-ს (ინახება მხოლოდ მეხსიერებაში);
 * ახალი პაროლი იგზავნება მხოლოდ ამ token-ით.
 */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailNotFound, setEmailNotFound] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [redirectIn, setRedirectIn] = useState(REDIRECT_SECONDS);
  const [error, setError] = useState('');

  const vc = useVerificationCode({
    sendUrl: '/auth-password-reset-code-send',
    statusUrl: '/auth-password-reset-code-status',
    storageKey: 'recovery:pendingEmail',
    done: Boolean(resetToken) || done,
    onRestore: setEmail,
  });

  const step = done ? 'done' : resetToken ? 'password' : vc.codeSent ? 'code' : 'email';

  // წარმატების შემდეგ — ავტომატური გადასვლა შესვლის გვერდზე
  useEffect(() => {
    if (!done) return undefined;
    if (redirectIn <= 0) {
      navigate('/login', { replace: true, state: { email } });
      return undefined;
    }
    const t = setTimeout(() => setRedirectIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [done, redirectIn, navigate, email]);

  // ---- ნაბიჯი 1: ელ. ფოსტა
  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    setEmailNotFound(false);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('შეიყვანეთ სწორი ელ. ფოსტა');
      return;
    }
    setEmailError('');
    const r = await vc.send(email.trim());
    if (r.skipped) return;
    if (!r.ok) {
      if (r.data?.code === 'EMAIL_NOT_FOUND') {
        setEmailNotFound(true);
        setEmailError('ელ. ფოსტა ვერ მოიძებნა. გთხოვთ, დარეგისტრირდეთ.');
      } else if (r.data?.field === 'email') setEmailError(r.error);
      else setError(r.error);
      return;
    }
    setCode('');
    toast({
      type: 'success',
      title: r.isResend ? 'ახალი კოდი გაიგზავნა' : 'აღდგენის კოდი წარმატებით გაიგზავნა',
      description: r.isResend ? 'ახალი ვერიფიკაციის კოდი გაიგზავნა თქვენს ელ. ფოსტაზე' : undefined,
    });
  };

  const changeEmail = () => {
    vc.reset();
    setCode('');
    setError('');
  };

  // ---- ნაბიჯი 2: კოდის დადასტურება → reset token
  const verifyCode = async () => {
    setError('');
    setVerifying(true);
    try {
      const { data } = await api.post('/auth-password-reset-code-verify', { email: email.trim(), code });
      setResetToken(data.resetToken);
      vc.clearStorage();
      toast({ type: 'success', title: 'კოდი დადასტურდა', description: 'შეიყვანეთ ახალი პაროლი' });
    } catch (err) {
      const res = err.response?.data;
      if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'CODE_NOT_FOUND'].includes(res?.code)) setCode('');
      if (res?.code === 'CODE_EXPIRED') vc.markExpired();
      else setError(res?.message || 'კოდის შემოწმება ვერ მოხერხდა');
    } finally {
      setVerifying(false);
    }
  };

  // ---- ნაბიჯი 3: ახალი პაროლი
  const live = {
    newPassword: validatePassword(passwords.newPassword),
    confirmPassword: !passwords.confirmPassword
      ? 'გაიმეორეთ ახალი პაროლი'
      : passwords.confirmPassword !== passwords.newPassword
        ? PASSWORDS_MISMATCH_MESSAGE
        : null,
  };
  const shown = (name) => serverFieldErrors[name] || (touched[name] ? live[name] : null);
  const canSubmit = !live.newPassword && !live.confirmPassword && !submitting;

  const onPasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords((p) => ({ ...p, [name]: value }));
    setServerFieldErrors((s) => ({ ...s, [name]: undefined }));
    // გამეორების ველი — შეუსაბამობა ჩანს აკრეფისთანავე
    if (name === 'confirmPassword' && value) setTouched((t) => ({ ...t, confirmPassword: true }));
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError('');
    setTouched({ newPassword: true, confirmPassword: true });
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/auth-password-reset', { resetToken, ...passwords });
      setResetToken('');
      setDone(true);
    } catch (err) {
      const res = err.response?.data;
      if (res?.code === 'RESET_TOKEN_INVALID' || res?.code === 'ACCOUNT_UNAVAILABLE') {
        // სესია ამოიწურა/გამოყენებულია — თავიდან დაწყება
        setResetToken('');
        setPasswords({ newPassword: '', confirmPassword: '' });
        vc.reset();
        setError(res.message);
      } else if (res?.field) setServerFieldErrors({ [res.field]: res.message });
      else setError(res?.message || 'პაროლის შეცვლა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const passwordProps = (name) => ({
    id: `rp-${name}`,
    name,
    value: passwords[name],
    onChange: onPasswordChange,
    onBlur: () => passwords[name] && setTouched((t) => ({ ...t, [name]: true })),
    disabled: submitting,
    autoComplete: 'new-password',
    className: shown(name) ? 'is-invalid' : '',
    'aria-invalid': Boolean(shown(name)),
    'aria-describedby': shown(name) ? `rp-${name}-error` : undefined,
  });

  return (
    <div className="auth">
      <div className="card auth-card recovery-card">
        <div className="auth-head">
          <div className="brand-mark">
            <Icon name={step === 'done' ? 'check' : 'lock'} size={22} />
          </div>
          <h1>ანგარიშის აღდგენა</h1>
          <p>
            {step === 'email' && 'შეიყვანეთ ანგარიშის ელ. ფოსტა — გამოგიგზავნით აღდგენის კოდს'}
            {step === 'code' && 'შეიყვანეთ ელ. ფოსტაზე მიღებული 4-ნიშნა კოდი'}
            {step === 'password' && 'შექმენით ახალი პაროლი'}
            {step === 'done' && 'პაროლი განახლებულია'}
          </p>
        </div>

        <Steps step={step} />

        <div className="form-stack">
          <Alert>{error}</Alert>

          {step === 'email' && (
            <form className="form-stack" onSubmit={sendCode} noValidate>
              <Field label="ელ. ფოსტა" required>
                <IconInput
                  icon="mail"
                  type="email"
                  id="rp-email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                    setEmailNotFound(false);
                  }}
                  className={emailError ? 'is-invalid' : ''}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'rp-email-error' : undefined}
                  disabled={Boolean(vc.sending)}
                  autoComplete="email"
                  placeholder="შეიყვანეთ ელ. ფოსტა"
                  autoFocus
                />
                {emailError && (
                  <span className="field-error" id="rp-email-error" role="alert">
                    {emailError}{' '}
                    {emailNotFound && (
                      <Link to="/register" className="link">
                        რეგისტრაცია
                      </Link>
                    )}
                  </span>
                )}
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={Boolean(vc.sending) || !email || vc.resendIn > 0}>
                {vc.sending ? (
                  <>
                    <span className="spinner" /> იგზავნება...
                  </>
                ) : (
                  <>
                    გაგრძელება <Icon name="arrowRight" size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'code' && (
            <>
              <div className="recovery-email">
                <Icon name="mail" size={16} />
                <span>{email}</span>
                <button type="button" className="link recovery-change" onClick={changeEmail}>
                  შეცვლა
                </button>
              </div>
              <VerificationCodePanel
                vc={vc}
                code={code}
                onCodeChange={setCode}
                onVerify={verifyCode}
                onResend={() => sendCode()}
                verifying={verifying}
              />
            </>
          )}

          {step === 'password' && (
            <form className="form-stack" onSubmit={submitPassword} noValidate>
              <Field label="ახალი პაროლი" required>
                <PasswordInput {...passwordProps('newPassword')} autoFocus />
                {shown('newPassword') && (
                  <span className="field-error" id="rp-newPassword-error" role="alert">
                    {shown('newPassword')}
                  </span>
                )}
                <PasswordRules password={passwords.newPassword} />
              </Field>
              <Field label="გაიმეორეთ ახალი პაროლი" required>
                <PasswordInput {...passwordProps('confirmPassword')} />
                {shown('confirmPassword') && (
                  <span className="field-error" id="rp-confirmPassword-error" role="alert">
                    {shown('confirmPassword')}
                  </span>
                )}
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <span className="spinner" /> ინახება...
                  </>
                ) : (
                  <>
                    <Icon name="lock" size={18} /> პაროლის შეცვლა
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'done' && (
            <>
              <Alert type="success">თქვენი პაროლი წარმატებით შეიცვალა. ახლა შეგიძლიათ შეხვიდეთ ახალი პაროლით.</Alert>
              <p className="field-hint" style={{ textAlign: 'center' }} aria-live="polite">
                შესვლის გვერდზე გადახვალთ {redirectIn} წამში...
              </p>
              <Link to="/login" state={{ email }} replace className="btn btn-primary btn-lg btn-block">
                შესვლა <Icon name="arrowRight" size={18} />
              </Link>
            </>
          )}
        </div>

        {step !== 'done' && (
          <p className="auth-foot">
            გაგახსენდათ პაროლი?{' '}
            <Link to="/login" className="link">
              შესვლა
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
