import { useEffect, useState } from 'react';
import Icon from '../../Icon';
import { TZ } from './format';

export const PRESETS = [
  { id: 'today', label: 'დღეს' },
  { id: '7d', label: '7 დღე' },
  { id: '30d', label: '30 დღე' },
  { id: '3m', label: '3 თვე' },
  { id: '1y', label: '1 წელი' },
  { id: 'custom', label: 'პერიოდი' },
];
const MAX_DAYS = 731; // იგივე ზღვარი, რაც სერვერზე (2 წელი)

export const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

/** კლიენტის ვალიდაცია (საბოლოო — სერვერზე) */
export const validateCustom = (from, to) => {
  if (!from || !to) return 'მიუთითეთ ორივე თარიღი';
  if (from > to) return 'საწყისი თარიღი საბოლოოზე გვიან არის';
  if (from > todayYmd()) return 'პერიოდი მომავალშია';
  if (days(from, to) > MAX_DAYS) return 'მაქსიმალური პერიოდი — 2 წელი';
  return '';
};

/**
 * საერთო თარიღის ფილტრი: პრესეტები ერთ რიგში + საკუთარი პერიოდი (ორივე დღე ჩათვლით, Asia/Tbilisi).
 * value: { range, from, to }; onChange იძახება მხოლოდ ვალიდურ მნიშვნელობაზე.
 */
const DateRangeControl = ({ value, onChange }) => {
  const [custom, setCustom] = useState({ from: value.from || '', to: value.to || '' });
  const [open, setOpen] = useState(value.range === 'custom');
  const [error, setError] = useState('');

  useEffect(() => {
    setCustom({ from: value.from || '', to: value.to || '' });
    setOpen(value.range === 'custom');
  }, [value.range, value.from, value.to]);

  const pick = (id) => {
    setError('');
    if (id === 'custom') {
      setOpen(true);
      return;
    }
    setOpen(false);
    onChange({ range: id });
  };

  const apply = (e) => {
    e.preventDefault();
    const msg = validateCustom(custom.from, custom.to);
    setError(msg);
    if (!msg) onChange({ range: 'custom', from: custom.from, to: custom.to });
  };

  const active = open ? 'custom' : value.range;
  return (
    <div className="an-range">
      <div className="an-presets" role="group" aria-label="პერიოდი">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={`an-preset ${active === p.id ? 'active' : ''}`} aria-pressed={active === p.id} onClick={() => pick(p.id)}>
            {p.id === 'custom' && <Icon name="clock" size={14} />}
            {p.label}
          </button>
        ))}
      </div>
      {open && (
        <form className="an-custom" onSubmit={apply} noValidate>
          <label>
            <span>დან</span>
            <input className="input input-sm" type="date" value={custom.from} max={todayYmd()} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-invalid={!!error} />
          </label>
          <label>
            <span>მდე</span>
            <input className="input input-sm" type="date" value={custom.to} max={todayYmd()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-invalid={!!error} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            გამოყენება
          </button>
          {error && (
            <span className="field-error" role="alert">
              {error}
            </span>
          )}
        </form>
      )}
    </div>
  );
};

export default DateRangeControl;
