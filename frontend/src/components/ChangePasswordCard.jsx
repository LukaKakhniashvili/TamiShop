import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/UIContext';
import Icon from './Icon';
import PasswordRules from './PasswordRules';
import { Alert, Field, PasswordInput } from './ui';
import { PASSWORDS_MISMATCH_MESSAGE, validatePassword } from '../utils/passwordPolicy';

const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
const SAME_PASSWORD_MESSAGE = 'ახალი პაროლი უნდა განსხვავდებოდეს მიმდინარე პაროლისგან.';

// კლიენტის ვალიდაცია — იგივე წესები, რასაც სერვერი ამოწმებს (backend/controllers/passwordController.js)
const validate = (f) => {
  const e = {};
  if (!f.currentPassword) e.currentPassword = 'შეიყვანეთ მიმდინარე პაროლი';
  const policy = validatePassword(f.newPassword);
  if (policy) e.newPassword = policy;
  else if (f.currentPassword && f.newPassword === f.currentPassword) e.newPassword = SAME_PASSWORD_MESSAGE;
  if (!f.confirmPassword) e.confirmPassword = 'გაიმეორეთ ახალი პაროლი';
  else if (f.confirmPassword !== f.newPassword) e.confirmPassword = PASSWORDS_MISMATCH_MESSAGE;
  return e;
};

/** პროფილი → პაროლის შეცვლა (ავტორიზებული მომხმარებელი) */
const ChangePasswordCard = () => {
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
      setSuccess('პაროლი წარმატებით შეიცვალა.');
      toast({ type: 'success', title: 'პაროლი წარმატებით შეიცვალა.' });
    } catch (err) {
      const res = err.response?.data;
      if (res?.code === 'NO_PASSWORD') setNoPassword(true);
      if (res?.field) {
        setErrors({ [res.field]: res.message });
        document.getElementById(`cp-${res.field}`)?.focus();
      } else setError(res?.message || 'პაროლის შეცვლა ვერ მოხერხდა. სცადეთ თავიდან.');
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
        <Icon name="lock" size={18} /> პაროლის შეცვლა
      </h2>

      <div className="form-stack">
        <Alert>{error}</Alert>
        {noPassword && (
          <Alert type="info">
            <Link to="/forgot-password" className="link">
              ანგარიშის აღდგენა
            </Link>
          </Alert>
        )}
        <Alert type="success">{success}</Alert>

        <Field label="მიმდინარე პაროლი" required>
          <PasswordInput {...fieldProps('currentPassword', 'current-password')} />
          <FieldError name="currentPassword" />
        </Field>

        <div className="form-grid">
          <Field label="ახალი პაროლი" required>
            <PasswordInput {...fieldProps('newPassword', 'new-password')} />
            <FieldError name="newPassword" />
          </Field>
          <Field label="გაიმეორეთ ახალი პაროლი" required>
            <PasswordInput {...fieldProps('confirmPassword', 'new-password')} />
            <FieldError name="confirmPassword" />
          </Field>
        </div>
        <PasswordRules password={form.newPassword} />

        <div className="form-actions">
          <button className="btn btn-primary btn-lg" type="submit" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" /> ინახება...
              </>
            ) : (
              <>
                <Icon name="lock" size={18} /> პაროლის შეცვლა
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ChangePasswordCard;
