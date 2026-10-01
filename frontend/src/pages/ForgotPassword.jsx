import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useToast } from '../context/UIContext';
import Icon from '../components/Icon';
import PasswordRules from '../components/PasswordRules';
import VerificationCodePanel from '../components/VerificationCodePanel';
import { Alert, Field, IconInput, PasswordInput } from '../components/ui';
import useVerificationCode from '../hooks/useVerificationCode';
import { passwordsMismatchMessage, validatePassword } from '../utils/passwordPolicy';
import { apiErrorMessage } from '../i18n/errors';
import useDocumentMeta from '../hooks/useDocumentMeta';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REDIRECT_SECONDS = 4;

const STEPS = ['email', 'code', 'password'];

const Steps = ({ step }) => {
  const { t } = useTranslation();
  const current = step === 'done' ? STEPS.length : STEPS.indexOf(step);
  return (
    <div className="steps recovery-steps" aria-label={t('recovery.stepsLabel')}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: 'contents' }}>
          {i > 0 && <div className={`line ${i <= current ? 'done' : ''}`} />}
          <div className={`step ${i < current ? 'done' : i === current ? 'active' : ''}`} aria-current={i === current ? 'step' : undefined}>
            <span className="dot">{i < current ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}</span>
            <span className="step-label">{t(`recovery.steps.${s}`)}</span>
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
  const { t } = useTranslation();
  useDocumentMeta(t('recovery.title'));
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
    const timer = setTimeout(() => setRedirectIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [done, redirectIn, navigate, email]);

  // ---- ნაბიჯი 1: ელ. ფოსტა
  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    setEmailNotFound(false);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t('errors.codes.INVALID_EMAIL'));
      return;
    }
    setEmailError('');
    const r = await vc.send(email.trim());
    if (r.skipped) return;
    if (!r.ok) {
      if (r.data?.code === 'EMAIL_NOT_FOUND') {
        setEmailNotFound(true);
        setEmailError(t('errors.codes.EMAIL_NOT_FOUND'));
      } else if (r.data?.field === 'email') setEmailError(r.error);
      else setError(r.error);
      return;
    }
    setCode('');
    toast({
      type: 'success',
      title: r.isResend ? t('otp.resentTitle') : t('recovery.codeSent'),
      description: r.isResend ? t('otp.resentText') : undefined,
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
      toast({ type: 'success', title: t('recovery.codeVerified'), description: t('recovery.enterNewPassword') });
    } catch (err) {
      const res = err.response?.data;
      if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'CODE_NOT_FOUND'].includes(res?.code)) setCode('');
      if (res?.code === 'CODE_EXPIRED') vc.markExpired();
      else setError(apiErrorMessage(err, 'otp.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  // ---- ნაბიჯი 3: ახალი პაროლი
  const live = {
    newPassword: validatePassword(passwords.newPassword),
    confirmPassword: !passwords.confirmPassword
      ? t('password.repeatRequired')
      : passwords.confirmPassword !== passwords.newPassword
        ? passwordsMismatchMessage()
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
        setError(apiErrorMessage(err, 'password.changeFailed'));
      } else if (res?.field) setServerFieldErrors({ [res.field]: apiErrorMessage(err, 'password.changeFailed') });
      else setError(apiErrorMessage(err, 'password.changeFailed'));
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
          <h1>{t('recovery.title')}</h1>
          <p>
            {t(`recovery.subtitle.${step}`)}
          </p>
        </div>

        <Steps step={step} />

        <div className="form-stack">
          <Alert>{error}</Alert>

          {step === 'email' && (
            <form className="form-stack" onSubmit={sendCode} noValidate>
              <Field label={t('auth.email')} required>
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
                  placeholder={t('recovery.emailPlaceholder')}
                  autoFocus
                />
                {emailError && (
                  <span className="field-error" id="rp-email-error" role="alert">
                    {emailError}{' '}
                    {emailNotFound && (
                      <Link to="/register" className="link">
                        {t('auth.register.link')}
                      </Link>
                    )}
                  </span>
                )}
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={Boolean(vc.sending) || !email || vc.resendIn > 0}>
                {vc.sending ? (
                  <>
                    <span className="spinner" /> {t('common.sending')}
                  </>
                ) : (
                  <>
                    {t('common.continue')} <Icon name="arrowRight" size={18} />
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
                  {t('common.change')}
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
              <Field label={t('password.new')} required>
                <PasswordInput {...passwordProps('newPassword')} autoFocus />
                {shown('newPassword') && (
                  <span className="field-error" id="rp-newPassword-error" role="alert">
                    {shown('newPassword')}
                  </span>
                )}
                <PasswordRules password={passwords.newPassword} />
              </Field>
              <Field label={t('password.repeat')} required>
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
                    <span className="spinner" /> {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Icon name="lock" size={18} /> {t('password.change')}
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'done' && (
            <>
              <Alert type="success">{t('recovery.successText')}</Alert>
              <p className="field-hint" style={{ textAlign: 'center' }} aria-live="polite">
                {t('recovery.redirectIn', { count: redirectIn })}
              </p>
              <Link to="/login" state={{ email }} replace className="btn btn-primary btn-lg btn-block">
                {t('auth.login.submit')} <Icon name="arrowRight" size={18} />
              </Link>
            </>
          )}
        </div>

        {step !== 'done' && (
          <p className="auth-foot">
            {t('recovery.remembered')}{' '}
            <Link to="/login" className="link">
              {t('auth.login.submit')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
