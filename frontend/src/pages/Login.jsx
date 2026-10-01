import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import Icon from '../components/Icon';
import { Alert, Field, IconInput, PasswordInput } from '../components/ui';
import { apiErrorMessage } from '../i18n/errors';
import useDocumentMeta from '../hooks/useDocumentMeta';

const Login = () => {
  const { t, i18n } = useTranslation();
  const { loginWithGoogle, login: authLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // პაროლის აღდგენის შემდეგ ელ. ფოსტა წინასწარ შევსებულია
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || '/';
  useDocumentMeta(t('auth.login.metaTitle'));

  const onLoggedIn = (user) => {
    toast({ title: user?.firstName ? t('auth.login.welcomeName', { name: user.firstName }) : t('auth.login.welcome') });
    navigate(redirectTo, { replace: true });
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      onLoggedIn(await loginWithGoogle(credentialResponse.credential));
    } catch (err) {
      setError(apiErrorMessage(err, 'auth.login.googleFailed'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      onLoggedIn(await authLogin(email, password));
    } catch (err) {
      setError(apiErrorMessage(err, 'auth.login.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-head">
          <div className="brand-mark">
            <Icon name="user" size={22} />
          </div>
          <h1>{t('auth.login.title')}</h1>
          <p>{t('auth.login.subtitle')}</p>
        </div>

        <div className="form-stack">
          <Alert>{error}</Alert>

          <Field label={t('auth.email')}>
            <IconInput
              icon="mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              autoComplete="email"
              placeholder="name@example.com"
              autoFocus
            />
          </Field>

          <Field label={t('auth.password')}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" /> {t('auth.login.submitting')}
              </>
            ) : (
              <>
                {t('auth.login.submit')} <Icon name="arrowRight" size={18} />
              </>
            )}
          </button>
        </div>

        <div className="or-divider">{t('auth.or')}</div>

        <div className="google-wrap">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError(t('auth.login.googleFailed'))}
            shape="pill"
            locale={i18n.language}
          />
        </div>

        <p className="auth-foot">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" state={location.state} className="link">
            {t('auth.register.link')}
          </Link>
        </p>
        <p className="auth-foot auth-foot-secondary">
          {t('auth.login.cantSignIn')}{' '}
          <Link to="/forgot-password" className="link">
            {t('auth.login.recover')}
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
