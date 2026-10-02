const httpError = require('../../utils/httpError');

/*
 * ანალიტიკის თარიღის დიაპაზონი — ერთადერთი ადგილი, სადაც განისაზღვრება:
 *   • დროის სარტყელი (Asia/Tbilisi) — დღის საზღვრები და დაჯგუფება ($dateTrunc timezone);
 *   • ნახევრად ღია დიაპაზონი [start, end) — end ყოველთვის გამორიცხულია;
 *   • წინა პერიოდი — იგივე ხანგრძლივობა უშუალოდ start-მდე: [start − (end − start), start);
 *   • დაჯგუფება (hour / day / week / month) — გრაფიკის წერტილების შეზღუდული რაოდენობით.
 * offset-ი მყარად არ არის ჩაწერილი — Intl-ით ითვლება (IANA ზონის წესებით).
 */

const TIMEZONE = 'Asia/Tbilisi';
const PRESETS = ['today', '7d', '30d', '3m', '1y', 'custom'];
const MAX_CUSTOM_DAYS = 731; // 2 წელი (ნაკიანი წლის ჩათვლით)
const DAY = 24 * 60 * 60 * 1000;

const invalid = (code, message) => httpError(400, message, { code });

/** ზონის offset (ms) მოცემულ მომენტში, მაგ. +04:00 → 14400000 */
const offsetAt = (date) => {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value; // "GMT+04:00" | "GMT"
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part || '');
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) * 60 * 1000;
};

/** ადგილობრივი კალენდარული თარიღი (YYYY-MM-DD) მოცემული მომენტისთვის */
const localYmd = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

const parseYmd = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null; // 2026-02-30
  return { y, mo, d };
};

/** ადგილობრივი შუაღამე (Asia/Tbilisi) → UTC Date */
const localMidnight = ({ y, mo, d }) => {
  const guess = Date.UTC(y, mo - 1, d);
  const first = guess - offsetAt(new Date(guess));
  return new Date(guess - offsetAt(new Date(first)));
};

const addDays = ({ y, mo, d }, n) => {
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

// თვის დამატება — თვის ბოლოზე „დაჭერით" (31 მარტი − 1 თვე → 28/29 თებერვალი)
const addMonths = ({ y, mo, d }, n) => {
  const first = new Date(Date.UTC(y, mo - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { y: first.getUTCFullYear(), mo: first.getUTCMonth() + 1, d: Math.min(d, last) };
};

const granularityFor = (ms) => (ms <= 2 * DAY ? 'hour' : ms <= 92 * DAY ? 'day' : ms <= 366 * DAY ? 'week' : 'month');

/**
 * query → { preset, start, end, prevStart, prevEnd, granularity, timezone }
 * preset: today | 7d | 30d | 3m | 1y | custom (from, to — YYYY-MM-DD, ორივე ჩათვლით)
 */
const parseRange = (query = {}, now = new Date()) => {
  const preset = query.range || '30d';
  if (!PRESETS.includes(preset)) throw invalid('INVALID_RANGE', 'არასწორი პერიოდი');
  const today = parseYmd(localYmd(now));
  let start;
  let end = now;
  let prevStart;

  if (preset === 'custom') {
    const from = parseYmd(query.from);
    const to = parseYmd(query.to);
    if (!from || !to) throw invalid('INVALID_DATE', 'თარიღის ფორმატი: YYYY-MM-DD');
    start = localMidnight(from);
    const endOfTo = localMidnight(addDays(to, 1));
    if (endOfTo <= start) throw invalid('INVALID_RANGE', 'საწყისი თარიღი საბოლოოზე გვიან არის');
    if ((endOfTo - start) / DAY > MAX_CUSTOM_DAYS + 0.1) throw httpError(400, 'მაქსიმალური პერიოდი — 2 წელი', { code: 'RANGE_TOO_LONG', maxDays: MAX_CUSTOM_DAYS });
    if (start >= now) throw invalid('INVALID_RANGE', 'პერიოდი მომავალშია');
    end = endOfTo < now ? endOfTo : now; // მომავალი ნაწილი იჭრება
    prevStart = new Date(start - (end - start)); // უშუალოდ წინა, იგივე ხანგრძლივობის
  } else {
    // წინა პერიოდი — იგივე კალენდარული წერტილი ერთი პერიოდით ადრე („დღეს 13:30-მდე" ↔ „გუშინ 13:30-მდე")
    const back = { today: [today, -1, 'd'], '7d': [addDays(today, -6), -7, 'd'], '30d': [addDays(today, -29), -30, 'd'], '3m': [addMonths(today, -3), -3, 'm'], '1y': [addMonths(today, -12), -12, 'm'] };
    const [from, n, unit] = back[preset];
    start = localMidnight(from);
    prevStart = localMidnight(unit === 'd' ? addDays(from, n) : addMonths(from, n));
  }

  const length = end - start;
  // იგივე ხანგრძლივობა; არასდროს გადაფარავს მიმდინარე პერიოდს
  const prevEnd = new Date(Math.min(prevStart.getTime() + length, start.getTime()));
  return {
    preset,
    start,
    end,
    prevStart,
    prevEnd,
    granularity: granularityFor(length),
    timezone: TIMEZONE,
  };
};

/** $dateTrunc-ის ბრძანება არჩეული დაჯგუფებით (კვირა — ორშაბათიდან) */
const truncExpr = (field, granularity) => ({
  $dateTrunc: { date: field, unit: granularity, timezone: TIMEZONE, ...(granularity === 'week' ? { startOfWeek: 'monday' } : {}) },
});

/** ყველა bucket-ის დასაწყისი [start, end) — ცარიელი პერიოდებიც (გრაფიკი ხვრელების გარეშე) */
const bucketStarts = ({ start, end, granularity }) => {
  const out = [];
  if (granularity === 'hour') {
    for (let t = Math.floor(start / 3600000) * 3600000; t < end; t += 3600000) out.push(new Date(t));
    return out;
  }
  let ymd = parseYmd(localYmd(start));
  if (granularity === 'week') {
    const weekday = (new Date(Date.UTC(ymd.y, ymd.mo - 1, ymd.d)).getUTCDay() + 6) % 7; // ორშაბათი = 0
    ymd = addDays(ymd, -weekday);
  }
  if (granularity === 'month') ymd = { ...ymd, d: 1 };
  for (let guard = 0; guard < 800; guard += 1) {
    const t = localMidnight(ymd);
    if (t >= end) break;
    out.push(t);
    ymd = granularity === 'day' ? addDays(ymd, 1) : granularity === 'week' ? addDays(ymd, 7) : addMonths(ymd, 1);
  }
  return out;
};

/** აგრეგაციის შედეგი ({ _id: Date, ... }) → სრული სერია ნულებით შევსებული */
const fillSeries = (range, rows, empty) => {
  const byTime = new Map(rows.map((r) => [new Date(r._id).getTime(), r]));
  return bucketStarts(range).map((t) => {
    const r = byTime.get(t.getTime());
    return { t: t.toISOString(), ...empty, ...(r ? Object.fromEntries(Object.keys(empty).map((k) => [k, r[k] ?? empty[k]])) : {}) };
  });
};

const toMeta = (r) => ({
  preset: r.preset,
  start: r.start.toISOString(),
  end: r.end.toISOString(),
  prevStart: r.prevStart.toISOString(),
  prevEnd: r.prevEnd.toISOString(),
  granularity: r.granularity,
  timezone: r.timezone,
});

module.exports = { TIMEZONE, PRESETS, MAX_CUSTOM_DAYS, parseRange, truncExpr, bucketStarts, fillSeries, toMeta, localYmd };
