import { formatPrice } from '../../ui';

/*
 * ანალიტიკის ფორმატირება (ადმინი — ქართულად, როგორც დანარჩენი ადმინ-პანელი).
 * თარიღები Asia/Tbilisi-ში — იგივე ზონა, რაც სერვერის დაჯგუფებაში.
 */

export const TZ = 'Asia/Tbilisi';
export const money = (v) => (v == null ? '—' : formatPrice(v));
export const count = (v) => (v == null ? '—' : new Intl.NumberFormat('ka-GE').format(v));
export const percent = (v) => (v == null ? '—' : `${new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 1 }).format(v)}%`);

// მოკლე ფორმატი ღერძისთვის: 12 400 → 12.4K
export const compactMoney = (v) => (Math.abs(v) >= 1000 ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v / 1000)}K ₾` : `${Math.round(v)} ₾`);

const fmt = (opts) => new Intl.DateTimeFormat('ka-GE', { timeZone: TZ, ...opts });
export const formatDay = (iso) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** bucket-ის წარწერა დაჯგუფების მიხედვით */
export const bucketLabel = (iso, granularity, long = false) => {
  const d = new Date(iso);
  if (granularity === 'hour') return fmt({ hour: '2-digit', minute: '2-digit', ...(long ? { day: 'numeric', month: 'short' } : {}) }).format(d);
  if (granularity === 'month') return fmt({ month: long ? 'long' : 'short', year: 'numeric' }).format(d);
  const day = fmt({ day: 'numeric', month: 'short', ...(long ? { year: 'numeric' } : {}) }).format(d);
  return granularity === 'week' && long ? `კვირა ${day}-დან` : day;
};

/** [start, end) → ადამიანური წარწერა (end გამორიცხულია: ბოლო დღე = end − 1ms) */
export const rangeLabel = (start, end) => {
  if (!start || !end) return '';
  const a = formatDay(start);
  const b = formatDay(new Date(new Date(end).getTime() - 1).toISOString());
  return a === b ? a : `${a} – ${b}`;
};

// ადმინი ქართულია — პროდუქტის საბაზო (ქართული) სახელი
export const productName = (p) => p?.name || 'უცნობი პროდუქტი';

export const PAYMENT_LABELS = { cod: 'კურიერთან გადახდა', card: 'ბარათით', unknown: 'უცნობი (ძველი შეკვეთები)' };
export const STATUS_LABELS = {
  pending: 'მოლოდინში',
  processing: 'მუშავდება',
  shipped: 'გაგზავნილია',
  completed: 'დასრულებულია',
  cancelled: 'გაუქმებულია',
};
