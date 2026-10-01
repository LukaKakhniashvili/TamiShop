import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useToast } from '../context/UIContext';
import Icon from './Icon';
import PasswordRules from './PasswordRules';
import { Alert, Field, PasswordInput } from './ui';
import { passwordsMismatchMessage, validatePassword } from '../utils/passwordPolicy';
import i18n from '../i18n';
import { apiErrorMessage } from '../i18n/errors';

const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };

// კლიენტის ვალიდაცია — იგივე წესები, რასაც სერვერი ამოწმებს (backend/controllers/passwordController.js)
const validate = (f) => {
  const e = {};
  if (!f.currentPassword) e.currentPassword = i18n.t('errors.codes.CURRENT_PASSWORD_REQUIRED');
  const policy = validatePassword(f.newPassword);
  if (policy) e.newPassword = policy;
  else if (f.currentPassword && f.newPassword === f.currentPassword) e.newPassword = i18n.t('errors.codes.SAME_PASSWORD');
  if (!f.confirmPassword) e.confirmPassword = i18n.t('password.repeatRequired');
  else if (f.confirmPassword !== f.newPassword) e.confirmPassword = passwordsMismatchMessage();
  return e;
};

/** პროფილი → პაროლის შეცვლა (ავტორიზებული მომხმარებელი) */
const ChangePasswordCard = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [noPassword, setNoPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // ფორმის მიმდინარე შეცდომები (ნაჩვენებია ველის შეხების ან გაგზავნის მცდელობის შემდეგ) + სერვერის შეცდომები
  const live = validate(form);
  const shown = (name) => errors[name] || (touched[name] ? live[name] : undefined);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
    setSuccess('');
  };
  const onBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: Boolean(form[e.target.name]) || t[e.target.name] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setNoPassword(false);
    const v = validate(form);
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });
    if (Object.keys(v).length) {
      document.getElementById(`cp-${Object.keys(v)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/auth-password-change', form);
      // ამ მოწყობილობაზე სესია ახალი ტოკენით გრძელდება (ძველი ტოკენები სერვერზე გაუქმდა)
      if (data?.token) localStorage.setItem('token', data.token);
      setForm(empty);
      setTouched({});
      setErrors({});
      setSuccess(t('password.changed'));
      toast({ type: 'success', title: t('password.changed') });
    } catch (err) {
      const res = err.response?.data;
      if (res?.code === 'NO_PASSWORD') setNoPassword(true);
      if (res?.field) {
        setErrors({ [res.field]: apiErrorMessage(err, 'password.changeFailed') });
        document.getElementById(`cp-${res.field}`)?.focus();
      } else setError(apiErrorMessage(err, 'password.changeFailed'));
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (name, autoComplete) => ({
    id: `cp-${name}`,
    name,
    value: form[name],
    onChange,
    onBlur,
    disabled: saving,
    autoComplete,
    className: shown(name) ? 'is-invalid' : '',
    'aria-invalid': Boolean(shown(name)),
    'aria-describedby': shown(name) ? `cp-${name}-error` : undefined,
  });

  const FieldError = ({ name }) =>
    shown(name) ? (
      <span className="field-error" id={`cp-${name}-error`} role="alert">
        {shown(name)}
      </span>
    ) : null;

  return (
    <form className="card card-pad change-password" onSubmit={handleSubmit} noValidate>
      <h2 className="card-title">
        <Icon name="lock" size={18} /> {t('password.change')}
      </h2>

      <div className="form-stack">
        <Alert>{error}</Alert>
        {noPassword && (
          <Alert type="info">
            <Link to="/forgot-password" className="link">
              {t('auth.login.recover')}
            </Link>
          </Alert>
        )}
        <Alert type="success">{success}</Alert>

        <Field label={t('password.current')} required>
          <PasswordInput {...fieldProps('currentPassword', 'current-password')} />
          <FieldError name="currentPassword" />
        </Field>

        <div className="form-grid">
          <Field label={t('password.new')} required>
            <PasswordInput {...fieldProps('newPassword', 'new-password')} />
            <FieldError name="newPassword" />
          </Field>
          <Field label={t('password.repeat')} required>
            <PasswordInput {...fieldProps('confirmPassword', 'new-password')} />
            <FieldError name="confirmPassword" />
          </Field>
        </div>
        <PasswordRules password={form.newPassword} />

        <div className="form-actions">
          <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" /> {t('common.saving')}
              </>
            ) : (
              <>
                <Icon name="lock" size={18} /> {t('password.change')}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ChangePasswordCard;
