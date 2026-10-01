import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { PASSWORD_RULES, passwordScore, ruleLabel } from '../utils/passwordPolicy';

/** პაროლის სიძლიერის ინდიკატორი და წესების ჩამონათვალი (რეგისტრაცია, შეცვლა, აღდგენა) */
const PasswordRules = ({ password, id }) => {
  const { t } = useTranslation();
  return (
    <>
      <div className="pw-meter" data-score={passwordScore(password)} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="pw-rules" id={id}>
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <span key={r.id} className={`pw-rule ${ok ? 'ok' : ''}`}>
              <span className="tick">
                <Icon name="check" size={10} strokeWidth={4} />
              </span>
              {ruleLabel(r, t)}
              <span className="sr-only">{ok ? ` — ${t('password.ruleMet')}` : ` — ${t('password.ruleNotMet')}`}</span>
            </span>
          );
        })}
      </div>
    </>
  );
};

export default PasswordRules;
