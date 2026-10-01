import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import Icon from '../components/Icon';
import { Alert, Field, IconInput, PasswordInput } from '../components/ui';

const Login = () => {
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

  const onLoggedIn = (user) => {
    toast({ title: `მოგესალმებით${user?.firstName ? `, ${user.firstName}` : ''}!` });
    navigate(redirectTo, { replace: true });
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      onLoggedIn(await loginWithGoogle(credentialResponse.credential));
    } catch (err) {
      setError(err.response?.data?.message || 'Google ავტორიზაცია ვერ მოხერხდა. სცადეთ თავიდან.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      onLoggedIn(await authLogin(email, password));
    } catch (err) {
      setError(err.response?.data?.message || 'ავტორიზაცია ვერ მოხერხდა. ელ. ფოსტა ან პაროლი არასწორია.');
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
          <h1>კეთილი იყოს თქვენი დაბრუნება</h1>
          <p>შედით თქვენს პირად პროფილში</p>
        </div>

        <div className="form-stack">
          <Alert>{error}</Alert>

          <Field label="ელ. ფოსტა">
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

          <Field label="პაროლი">
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
                <span className="spinner" /> შესვლა...
              </>
            ) : (
              <>
                შესვლა <Icon name="arrowRight" size={18} />
              </>
            )}
          </button>
        </div>

        <div className="or-divider">ან</div>

        <div className="google-wrap">
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google ავტორიზაცია ვერ მოხერხდა')} shape="pill" />
        </div>

        <p className="auth-foot">
          ჯერ არ გაქვთ ანგარიში?{' '}
          <Link to="/register" state={location.state} className="link">
            რეგისტრაცია
          </Link>
        </p>
        <p className="auth-foot auth-foot-secondary">
          ვერ შედიხართ ანგარიშზე?{' '}
          <Link to="/forgot-password" className="link">
            ანგარიშის აღდგენა
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
