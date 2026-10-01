import Icon from './Icon';
import { Alert, Field } from './ui';
import { formatClock } from '../hooks/useVerificationCode';

/**
 * კოდის შეყვანის პანელი — ინფორმაცია (3 წთ ვადა + დარჩენილი დრო), 4-ნიშნა კოდი, დადასტურება,
 * „კოდის ხელახლა მოთხოვნა" 30 წმ ტაიმერით. მდგომარეობას მართავს useVerificationCode.
 */
const VerificationCodePanel = ({ vc, code, onCodeChange, onVerify, onResend, verifying, disabled }) => (
  <div className="otp-panel">
    {vc.codeExpired ? (
      <Alert type="warning">ვერიფიკაციის კოდის ვადა ამოიწურა. გთხოვთ, მოითხოვოთ ახალი კოდი.</Alert>
    ) : (
      <Alert type="info">
        ვერიფიკაციის კოდი გაიგზავნა თქვენს ელ. ფოსტაზე. კოდის მოქმედების ვადა: {Math.round(vc.validitySeconds / 60)} წუთი
        {vc.expiresIn > 0 && (
          <>
            {' '}
            · დარჩა <span className="otp-timer">{formatClock(vc.expiresIn)}</span>
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
          {verifying ? <span className="spinner" /> : 'დადასტურება'}
        </button>
      </div>
    </Field>

    <div className="otp-resend">
      <span id="otp-resend-status">
        {vc.resendIn > 0 ? (
          <>
            კოდის ხელახლა მოთხოვნა შესაძლებელია <span className="otp-timer">{formatClock(vc.resendIn)}</span>-ში
          </>
        ) : (
          'არ მიგიღიათ კოდი?'
        )}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={onResend}
        disabled={vc.resendIn > 0 || Boolean(vc.sending) || disabled}
        aria-describedby="otp-resend-status"
        title={vc.resendIn > 0 ? `ხელმისაწვდომი იქნება ${formatClock(vc.resendIn)}-ში` : undefined}
      >
        {vc.sending === 'resend' ? (
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
);

export default VerificationCodePanel;
