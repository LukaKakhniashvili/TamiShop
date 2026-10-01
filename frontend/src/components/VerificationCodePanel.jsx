import { Trans, useTranslation } from 'react-i18next';
import Icon from './Icon';
import { Alert, Field } from './ui';
import { formatClock } from '../hooks/useVerificationCode';

/**
 * კოდის შეყვანის პანელი — ინფორმაცია (3 წთ ვადა + დარჩენილი დრო), 4-ნიშნა კოდი, დადასტურება,
 * „კოდის ხელახლა მოთხოვნა" 30 წმ ტაიმერით. მდგომარეობას მართავს useVerificationCode.
 */
const VerificationCodePanel = ({ vc, code, onCodeChange, onVerify, onResend, verifying, disabled }) => {
  const { t } = useTranslation();
  return (
  <div className="otp-panel">
    {vc.codeExpired ? (
      <Alert type="warning">{t('otp.expired')}</Alert>
    ) : (
      <Alert type="info">
        {t('otp.sentInfo', { count: Math.round(vc.validitySeconds / 60) })}
        {vc.expiresIn > 0 && (
          <>
            {' '}
            · {t('otp.remaining')} <span className="otp-timer">{formatClock(vc.expiresIn)}</span>
          </>
        )}
      </Alert>
    )}

    <Field label={t('otp.label')} required hint={t('otp.hint')}>
      <div className="input-row">
        <input
          className="input otp-input"
          type="text"
          inputMode="numeric"
          name="code"
          placeholder="••••"
          maxLength="4"
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            // Enter კოდის ველში — დადასტურება (მშობელი ფორმა არ იგზავნება)
            if (e.key === 'Enter') {
              e.preventDefault();
              if (code.length === 4 && !verifying && !vc.codeExpired) onVerify();
            }
          }}
          disabled={disabled || vc.codeExpired}
          autoFocus
          autoComplete="one-time-code"
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ height: 46 }}
          onClick={onVerify}
          disabled={verifying || code.length < 4 || disabled || vc.codeExpired}
        >
          {verifying ? <span className="spinner" /> : t('otp.verify')}
        </button>
      </div>
    </Field>

    <div className="otp-resend">
      <span id="otp-resend-status">
        {vc.resendIn > 0 ? (
          <>
            <Trans i18nKey="otp.resendIn" values={{ time: formatClock(vc.resendIn) }} components={{ timer: <span className="otp-timer" /> }} />
          </>
        ) : (
          t('otp.notReceived')
        )}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={onResend}
        disabled={vc.resendIn > 0 || Boolean(vc.sending) || disabled}
        aria-describedby="otp-resend-status"
        title={vc.resendIn > 0 ? t('otp.availableIn', { time: formatClock(vc.resendIn) }) : undefined}
      >
        {vc.sending === 'resend' ? (
          <>
            <span className="spinner" /> {t('common.sending')}
          </>
        ) : (
          <>
            <Icon name="refresh" size={14} /> {t('otp.resend')}
          </>
        )}
      </button>
    </div>
  </div>
  );
};

export default VerificationCodePanel;
