import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import DateRangeControl, { PRESETS } from '../../components/admin/analytics/DateRangeControl';
import KpiCard, { ChangeBadge } from '../../components/admin/analytics/KpiCard';
import Section from '../../components/admin/analytics/Section';
import BarList, { ColumnBars } from '../../components/admin/analytics/BarList';
import RankTable, { ProductCell } from '../../components/admin/analytics/RankTable';
import TimeSeriesChart from '../../components/admin/analytics/TimeSeriesChart';
import useAnalytics from '../../components/admin/analytics/useAnalytics';
import { Stars } from '../../components/reviews/Stars';
import { PAYMENT_LABELS, STATUS_LABELS, compactMoney, count, formatDay, money, percent, rangeLabel } from '../../components/admin/analytics/format';

/*
 * ბიზნეს-ანალიტიკა (ადმინი / მენეჯერი). ყველა რიცხვი სერვერზე ითვლება (services/analytics/*);
 * თითო სექცია დამოუკიდებლად იტვირთება — ერთის შეცდომა დანარჩენს არ აჩერებს.
 * დიაპაზონი URL-შია (?range=30d | custom&from&to) — გაზიარება/განახლება ინარჩუნებს არჩევანს.
 */

const SERIES_1 = 'var(--series-1)';
const SERIES_2 = 'var(--series-2)';
const STATUS_TONES = { completed: 'tone-1', pending: 'tone-2', processing: 'tone-2', shipped: 'tone-2', cancelled: 'tone-muted' };

const useRangeParams = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get('range');
  const range = PRESETS.some((p) => p.id === raw) ? raw : '30d';
  const value = range === 'custom' ? { range, from: params.get('from') || '', to: params.get('to') || '' } : { range };
  const query = useMemo(() => (value.range === 'custom' ? { range: 'custom', from: value.from, to: value.to } : { range: value.range }), [value.range, value.from, value.to]);
  const set = (v) => setParams(v.range === 'custom' ? { range: 'custom', from: v.from, to: v.to } : { range: v.range }, { replace: true });
  return { value, query, set };
};

const MiniStat = ({ label, value, sub }) => (
  <div className="an-mini">
    <span>{label}</span>
    <strong>{value}</strong>
    {sub && <small>{sub}</small>}
  </div>
);

const Definitions = () => (
  <details className="an-defs card">
    <summary>
      <Icon name="info" size={16} /> როგორ ითვლება მაჩვენებლები?
    </summary>
    <ul>
      <li>
        <b>შემოსავალი (რეალიზებული)</b> — მხოლოდ <b>დასრულებული</b> შეკვეთების ჯამი (თანხა მიღებულია). კურიერთან გადახდის
        შეკვეთა შემოსავლად ითვლება მხოლოდ ჩაბარების შემდეგ.
      </li>
      <li>
        <b>ღია შეკვეთების ღირებულება (მოსალოდნელი)</b> — მოლოდინში / მუშავდება / გაგზავნილი შეკვეთები. ეს ჯერ არ არის შემოსავალი და
        შეიძლება გაუქმდეს.
      </li>
      <li>
        <b>შეკვეთები</b> — დადასტურებული შეკვეთები გაუქმებულის გარეშე (ბარათით გადაუხდელი მცდელობა არ ითვლება).{' '}
        <b>საშუალო შეკვეთა</b> = ამ შეკვეთების ღირებულება ÷ რაოდენობა.
      </li>
      <li>
        <b>მყიდველი მომხმარებლები</b> — განსხვავებული მომხმარებლები, რომლებსაც პერიოდში ≥1 ასეთი შეკვეთა აქვთ (არა ყველა
        რეგისტრირებული).
      </li>
      <li>ადმინისა და მენეჯერის ანგარიშების შეკვეთები და შეფასებები ბიზნეს-მაჩვენებლებში არ შედის.</li>
      <li>
        თარიღი — შეკვეთის განთავსების დრო, Asia/Tbilisi; პერიოდი მოიცავს დასაწყისს და არ მოიცავს დასასრულს. შედარება — იგივე
        ხანგრძლივობის წინა პერიოდთან.
      </li>
    </ul>
  </details>
);

const AdminAnalytics = () => {
  const { value, query, set } = useRangeParams();
  const summary = useAnalytics('analytics-summary', query);
  const sales = useAnalytics('analytics-sales', query);
  const products = useAnalytics('analytics-products', query);
  const customers = useAnalytics('analytics-customers', query);
  const wishlist = useAnalytics('analytics-wishlist', null);
  const reviews = useAnalytics('analytics-reviews', query);

  const meta = summary.data?.meta || sales.data?.meta;
  const k = summary.data;
  const kpi = (key) => ({ current: k?.current?.[key], previous: k?.previous?.[key], change: k?.change?.[key] });

  const s = sales.data;
  const series = s?.series || [];
  const salesEmpty = s && s.status.total === 0;
  const orderSeries = series.map((p) => ({ ...p, openOrders: p.orders - p.completedOrders }));

  const p = products.data;
  const c = customers.data;
  const w = wishlist.data;
  const r = reviews.data;

  return (
    <div className="an-page">
      <div className="admin-head an-head">
        <div>
          <h1>ანალიტიკა</h1>
          <p>
            {meta ? rangeLabel(meta.start, meta.end) : 'ბიზნეს-მაჩვენებლები'}
            {meta && <span className="muted"> · შედარება: {rangeLabel(meta.prevStart, meta.prevEnd)} · Asia/Tbilisi</span>}
          </p>
        </div>
      </div>

      <div className="card an-filters">
        <DateRangeControl value={value} onChange={set} />
      </div>

      {/* ---------------- KPI */}
      {summary.status === 'error' ? (
        <Section title="ძირითადი მაჩვენებლები" status="error" error={summary.error} onRetry={summary.retry} />
      ) : (
        <div className="an-kpis" aria-live="polite">
          <KpiCard
            icon="receipt"
            tone="ok"
            label="შემოსავალი (რეალიზებული)"
            value={money(kpi('revenue').current)}
            {...kpi('revenue')}
            format={money}
            hint={k && `დასრულებული შეკვეთები: ${count(k.current.completedOrders)}`}
            loading={summary.status === 'loading'}
          />
          <KpiCard
            icon="clock"
            tone="warn"
            label="ღია შეკვეთების ღირებულება"
            value={money(kpi('openValue').current)}
            {...kpi('openValue')}
            format={money}
            hint={k && `მოსალოდნელი, ჯერ არ არის შემოსავალი · ${count(k.current.openOrders)} შეკვეთა`}
            loading={summary.status === 'loading'}
          />
          <KpiCard
            icon="box"
            label="შეკვეთები"
            value={count(kpi('orders').current)}
            {...kpi('orders')}
            format={count}
            hint="დადასტურებული, გაუქმების გარეშე"
            loading={summary.status === 'loading'}
          />
          <KpiCard
            icon="tag"
            label="საშუალო შეკვეთა (AOV)"
            value={money(kpi('aov').current)}
            {...kpi('aov')}
            format={money}
            hint="შეკვეთების ღირებულება ÷ შეკვეთები"
            loading={summary.status === 'loading'}
          />
          <KpiCard
            icon="users"
            label="მყიდველი მომხმარებლები"
            value={count(kpi('customers').current)}
            {...kpi('customers')}
            format={count}
            hint="განსხვავებული მომხმარებლები შეკვეთით"
            loading={summary.status === 'loading'}
          />
        </div>
      )}
      <Definitions />

      {/* ---------------- გაყიდვები დროში */}
      <Section
        id="an-revenue"
        title="შემოსავალი დროში"
        subtitle="რეალიზებული (დასრულებული) და ღია (მოსალოდნელი) ღირებულება — ზედ-დაწყობით, ჯამი = შეკვეთების ღირებულება"
        status={sales.status}
        error={sales.error}
        onRetry={sales.retry}
        empty={salesEmpty}
        emptyText="ამ პერიოდში შეკვეთები არ არის"
        skeleton={300}
      >
        <TimeSeriesChart
          data={series}
          granularity={s?.meta?.granularity}
          label="შემოსავალი დროში"
          format={money}
          axisFormat={compactMoney}
          series={[
            { key: 'revenue', label: 'რეალიზებული შემოსავალი', color: SERIES_1 },
            { key: 'openValue', label: 'ღია (მოსალოდნელი)', color: SERIES_2 },
          ]}
        />
      </Section>

      <Section
        id="an-orders"
        title="შეკვეთები დროში"
        subtitle="დადასტურებული შეკვეთები გაუქმების გარეშე"
        status={sales.status}
        error={sales.error}
        onRetry={sales.retry}
        empty={salesEmpty}
        emptyText="ამ პერიოდში შეკვეთები არ არის"
        skeleton={300}
      >
        <TimeSeriesChart
          data={orderSeries}
          granularity={s?.meta?.granularity}
          label="შეკვეთები დროში"
          format={count}
          series={[
            { key: 'completedOrders', label: 'დასრულებული', color: SERIES_1 },
            { key: 'openOrders', label: 'ღია', color: SERIES_2 },
          ]}
        />
      </Section>

      <div className="an-grid-2">
        <Section id="an-status" title="შეკვეთები სტატუსით" status={sales.status} error={sales.error} onRetry={sales.retry} empty={salesEmpty} emptyText="ამ პერიოდში შეკვეთები არ არის">
          {s && (
            <>
              <div className="an-minis">
                <MiniStat label="გაუქმების წილი" value={percent(s.status.cancellationRate)} sub={`${count(s.status.counts.cancelled)} / ${count(s.status.total)} შეკვეთა`} />
                <MiniStat
                  label="დასრულების წილი"
                  value={percent(s.status.completionRate)}
                  sub={s.status.completionRate == null ? 'დახურული შეკვეთები ჯერ არ არის' : 'დახურული შეკვეთებიდან (დასრულ. + გაუქმ.)'}
                />
              </div>
              <BarList
                label="შეკვეთები სტატუსით"
                total={s.status.total}
                items={Object.keys(STATUS_LABELS).map((st) => ({
                  key: st,
                  label: STATUS_LABELS[st],
                  value: s.status.counts[st],
                  display: count(s.status.counts[st]),
                  sub: money(s.status.values[st]),
                  tone: STATUS_TONES[st],
                }))}
              />
            </>
          )}
        </Section>

        <Section
          id="an-payments"
          title="გადახდის მეთოდები"
          subtitle="დადასტურებული შეკვეთები გაუქმების გარეშე"
          status={sales.status}
          error={sales.error}
          onRetry={sales.retry}
          empty={salesEmpty || !s?.payments?.length}
          emptyText="ამ პერიოდში შეკვეთები არ არის"
        >
          {s && (
            <BarList
              label="გადახდის მეთოდები"
              items={s.payments.map((m) => ({
                key: m.method,
                label: PAYMENT_LABELS[m.method] || m.method,
                value: m.orders,
                display: `${count(m.orders)} შეკვ.`,
                sub: `${money(m.value)} · რეალიზებული ${money(m.revenue)}`,
                tone: 'tone-1',
              }))}
            />
          )}
        </Section>
      </div>

      <Section
        id="an-categories"
        title="გაყიდვები კატეგორიით"
        subtitle="შეკვეთების ღირებულება (გაუქმების გარეშე) — ფასი შეკვეთის მომენტისა"
        badges={s?.categories?.some((x) => x.estimated) ? [{ label: 'ნაწილობრივ შეფასებითი', tone: 'pill-warning', icon: 'info', title: 'ძველ შეკვეთებს კატეგორიის snapshot არ აქვს — გამოყენებულია პროდუქტის მიმდინარე კატეგორია' }] : []}
        status={sales.status}
        error={sales.error}
        onRetry={sales.retry}
        empty={salesEmpty || !s?.categories?.length}
        emptyText="ამ პერიოდში გაყიდვები არ არის"
      >
        {s && (
          <>
            {s.categories.some((x) => x.estimated) && (
              <p className="an-note">
                <Icon name="info" size={15} /> ძველ შეკვეთებს კატეგორია არ ჰქონდათ შენახული — მათთვის გამოყენებულია პროდუქტის <b>მიმდინარე</b> კატეგორია
                (შეფასებითი). ახალი შეკვეთები კატეგორიას შეკვეთის მომენტში ინახავს.
              </p>
            )}
            <BarList
              label="გაყიდვები კატეგორიით"
              items={s.categories.map((x) => ({
                key: String(x.categoryId),
                label: x.name || 'უცნობი კატეგორია',
                note: x.deleted ? 'წაშლილი' : x.estimated ? `შეფასებითი: ${money(x.estimatedValue)}` : null,
                value: x.value,
                display: money(x.value),
                sub: `${count(x.units)} ერთ. · რეალიზებული ${money(x.revenue)}`,
                tone: 'tone-1',
              }))}
            />
          </>
        )}
      </Section>

      {/* ---------------- პროდუქტები */}
      <div className="an-grid-2">
        <Section
          id="an-best"
          title="ბესტსელერები"
          subtitle="რეალურად გაყიდული ერთეულები (გაუქმების გარეშე)"
          status={products.status}
          error={products.error}
          onRetry={products.retry}
          empty={!p?.bestSellers?.length}
          emptyText="ამ პერიოდში გაყიდვები არ არის"
        >
          {p && (
            <RankTable
              label="ბესტსელერები"
              rows={p.bestSellers}
              rowKey={(x) => String(x.productId)}
              columns={[
                { key: 'p', label: 'პროდუქტი', render: (x) => <ProductCell p={x} /> },
                { key: 'u', label: 'ერთეული', align: 'right', render: (x) => <b>{count(x.units)}</b> },
                { key: 'v', label: 'ღირებულება', align: 'right', render: (x) => money(x.value) },
              ]}
            />
          )}
        </Section>
        <Section
          id="an-top-revenue"
          title="ტოპ პროდუქტები შემოსავლით"
          subtitle="რეალიზებული (დასრულებული) შემოსავალი, შეკვეთის ფასით"
          status={products.status}
          error={products.error}
          onRetry={products.retry}
          empty={!p?.topRevenue?.length}
          emptyText="ამ პერიოდში დასრულებული გაყიდვები არ არის"
        >
          {p && (
            <RankTable
              label="ტოპ პროდუქტები შემოსავლით"
              rows={p.topRevenue}
              rowKey={(x) => String(x.productId)}
              columns={[
                { key: 'p', label: 'პროდუქტი', render: (x) => <ProductCell p={x} /> },
                { key: 'r', label: 'შემოსავალი', align: 'right', render: (x) => <b>{money(x.revenue)}</b> },
                { key: 'u', label: 'ერთეული', align: 'right', render: (x) => count(x.units) },
              ]}
            />
          )}
        </Section>
      </div>

      <Section
        id="an-low"
        title="სუსტი პროდუქტები"
        subtitle="აქტიური პროდუქტები, რომლებიც მთელი პერიოდის განმავლობაში იყიდებოდა და არც ერთი ერთეული არ გაიყიდა"
        badges={p ? [{ label: `სულ: ${count(p.lowPerformersTotal)}`, tone: 'pill-neutral' }] : []}
        status={products.status}
        error={products.error}
        onRetry={products.retry}
        empty={!p?.lowPerformers?.length}
        emptyText="ასეთი პროდუქტი არ არის (ან ყველა პროდუქტი ამ პერიოდში დაემატა)"
      >
        {p && (
          <RankTable
            label="სუსტი პროდუქტები"
            numbered={false}
            rows={p.lowPerformers}
            rowKey={(x) => String(x.productId)}
            columns={[
              { key: 'p', label: 'პროდუქტი', render: (x) => <ProductCell p={x} /> },
              { key: 's', label: 'დამატებულია', align: 'right', render: (x) => formatDay(x.listedSince) },
              { key: 'st', label: 'მარაგი', align: 'right', render: (x) => (x.inStock ? 'მარაგშია' : <span className="pill pill-warning no-dot">ამოწურულია</span>) },
              { key: 'w', label: 'რჩეულებში', align: 'right', render: (x) => count(x.wishlisted) },
            ]}
          />
        )}
      </Section>

      {/* ---------------- მომხმარებლები */}
      <Section id="an-customers" title="მომხმარებლები" status={customers.status} error={customers.error} onRetry={customers.retry} skeleton={220}>
        {c && (
          <>
            <div className="an-minis">
              <MiniStat label="მყიდველი მომხმარებლები" value={count(c.purchasing)} sub="≥1 შეკვეთა პერიოდში" />
              <MiniStat label="ახალი მყიდველები" value={count(c.newCustomers)} sub="პირველი შეკვეთა ამ პერიოდში" />
              <MiniStat label="დაბრუნებული მყიდველები" value={count(c.returning)} sub={c.returningRate == null ? 'შეკვეთა ამ პერიოდშიც და მანამდეც' : `${percent(c.returningRate)} · შეკვეთა მანამდეც`} />
              <MiniStat label="შეკვეთა მყიდველზე" value={c.avgOrdersPerCustomer == null ? '—' : count(c.avgOrdersPerCustomer)} sub="საშუალოდ, პერიოდში" />
              <MiniStat
                label="ახალი რეგისტრაციები"
                value={count(c.registrations)}
                sub={<ChangeBadge change={c.registrationsChange} current={c.registrations} previous={c.prevRegistrations} format={count} />}
              />
            </div>
            <h3 className="an-subtitle">ტოპ მყიდველები</h3>
            {c.top.length ? (
              <RankTable
                label="ტოპ მყიდველები"
                rows={c.top}
                rowKey={(x) => x.key}
                columns={[
                  {
                    key: 'n',
                    label: 'მომხმარებელი',
                    render: (x) => (
                      <span className="an-customer">
                        <span className="strong">{x.name || 'მომხმარებელი'}</span>
                        <span className="sub">{x.deleted ? 'წაშლილი ანგარიში' : x.email}</span>
                        {x.inactive && <span className="pill pill-neutral no-dot">გამორთული</span>}
                      </span>
                    ),
                  },
                  { key: 'o', label: 'შეკვეთები', align: 'right', render: (x) => count(x.orders) },
                  { key: 'r', label: 'რეალიზებული', align: 'right', render: (x) => <b>{money(x.revenue)}</b> },
                  { key: 'v', label: 'ღირებულება', align: 'right', render: (x) => money(x.value) },
                  { key: 'ret', label: 'ტიპი', align: 'right', render: (x) => <span className={`pill no-dot ${x.returning ? 'pill-info' : 'pill-success'}`}>{x.returning ? 'დაბრუნებული' : 'ახალი'}</span> },
                ]}
              />
            ) : (
              <div className="an-state">
                <Icon name="info" size={20} />
                <span>ამ პერიოდში მყიდველები არ არის</span>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ---------------- რჩეულები — მიმდინარე მდგომარეობა */}
      <Section
        id="an-wishlist"
        title="რჩეულები"
        subtitle="ახლანდელი მდგომარეობა — თარიღის ფილტრი არ გამოიყენება"
        badges={[{ label: 'მიმდინარე მდგომარეობა', tone: 'pill-info', icon: 'clock', title: 'რჩეულების ისტორია (დამატება/წაშლა) არ ინახება' }]}
        status={wishlist.status}
        error={wishlist.error}
        onRetry={wishlist.retry}
      >
        {w && (
          <>
            <div className="an-minis">
              <MiniStat label="ჩანაწერები რჩეულებში" value={count(w.entries)} />
              <MiniStat label="მომხმარებლები რჩეულებით" value={count(w.users)} />
              <MiniStat label="განსხვავებული პროდუქტი" value={count(w.products)} />
              <MiniStat label="საშუალოდ მომხმარებელზე" value={w.avgPerUser == null ? '—' : count(w.avgPerUser)} />
            </div>
            <p className="an-note">
              <Icon name="info" size={15} /> დამატებები დროში, რჩეულიდან ყიდვაზე კონვერსია და წაშლის წილი ზუსტად ვერ დაითვლება — წაშლილი ჩანაწერები
              ისტორიას არ ტოვებს. ამისთვის საჭიროა მოვლენების აღრიცხვა (მომავალი ეტაპი).
            </p>
            <h3 className="an-subtitle">ყველაზე ხშირად რჩეულებში</h3>
            {w.top.length ? (
              <RankTable
                label="ყველაზე ხშირად რჩეულებში"
                rows={w.top}
                rowKey={(x) => String(x.productId)}
                columns={[
                  { key: 'p', label: 'პროდუქტი', render: (x) => <ProductCell p={x} /> },
                  { key: 'n', label: 'მომხმარებელი', align: 'right', render: (x) => <b>{count(x.count)}</b> },
                ]}
              />
            ) : (
              <div className="an-state">
                <Icon name="heart" size={20} />
                <span>რჩეულებში ჯერ არაფერია</span>
              </div>
            )}
          </>
        )}
      </Section>

      {/* ---------------- შეფასებები */}
      <Section
        id="an-reviews"
        title="შეფასებები"
        subtitle="გამოქვეყნებული შეფასებები, შექმნის თარიღით პერიოდში"
        status={reviews.status}
        error={reviews.error}
        onRetry={reviews.retry}
        skeleton={220}
      >
        {r && (
          <>
            <div className="an-minis">
              <MiniStat label="გამოქვეყნებული" value={count(r.count)} sub={<ChangeBadge change={r.countChange} current={r.count} previous={r.prevCount} format={count} />} />
              <MiniStat
                label="საშუალო შეფასება"
                value={
                  r.average == null ? (
                    '—'
                  ) : (
                    <span className="an-rating">
                      {r.average.toFixed(1)} <Stars value={r.average} size={14} />
                    </span>
                  )
                }
              />
              <MiniStat label="დადასტურებული შენაძენი" value={count(r.verified)} />
              <MiniStat label="დამალული (მოდერაცია)" value={count(r.hidden)} sub="რეიტინგში არ ითვლება" />
            </div>
            {r.count === 0 ? (
              <div className="an-state">
                <Icon name="star" size={20} />
                <span>ამ პერიოდში გამოქვეყნებული შეფასებები არ არის</span>
              </div>
            ) : (
              <>
                <div className="an-grid-2 an-grid-tight">
                  <div>
                    <h3 className="an-subtitle">განაწილება</h3>
                    <BarList
                      label="შეფასებების განაწილება"
                      items={[5, 4, 3, 2, 1].map((n) => ({ key: n, label: `${n} ★`, value: r.distribution[n], display: count(r.distribution[n]), tone: 'tone-star' }))}
                    />
                  </div>
                  <div>
                    <h3 className="an-subtitle">შეფასებები დროში</h3>
                    <ColumnBars data={r.series} granularity={r.meta?.granularity} label="შეფასებები დროში" />
                  </div>
                </div>
                <h3 className="an-subtitle">ყველაზე მეტად შეფასებული</h3>
                <RankTable
                  label="ყველაზე მეტად შეფასებული"
                  rows={r.mostReviewed}
                  rowKey={(x) => String(x.productId)}
                  columns={[
                    { key: 'p', label: 'პროდუქტი', render: (x) => <ProductCell p={x} /> },
                    { key: 'n', label: 'შეფასება', align: 'right', render: (x) => <b>{count(x.count)}</b> },
                    { key: 'a', label: 'საშუალო', align: 'right', render: (x) => x.avg.toFixed(1) },
                  ]}
                />
                <p className="an-note">
                  <Icon name="info" size={15} /> რეიტინგულ სიებში მხოლოდ პროდუქტები მინიმუმ {r.rules.minReviews} შეფასებით; დალაგება ბაიესის საშუალოთი (m ={' '}
                  {r.rules.bayesM}), რომ ერთმა 5★ შეფასებამ სია არ დაიკავოს. ნაჩვენებია ნამდვილი საშუალო და რაოდენობა.
                </p>
                {r.rankedProducts === 0 ? (
                  <div className="an-state">
                    <Icon name="info" size={20} />
                    <span>არასაკმარისი მონაცემები: არც ერთ პროდუქტს არ აქვს {r.rules.minReviews} შეფასება ამ პერიოდში</span>
                  </div>
                ) : (
                  <div className="an-grid-2 an-grid-tight">
                    {[
                      ['highest', 'უმაღლესი რეიტინგი'],
                      ['lowest', 'ყველაზე დაბალი რეიტინგი'],
                    ].map(([key, title]) => (
                      <div key={key}>
                        <h3 className="an-subtitle">{title}</h3>
                        <RankTable
                          label={title}
                          rows={r[key]}
                          rowKey={(x) => String(x.productId)}
                          columns={[
                            { key: 'p', label: 'პროდუქტი', render: (x) => <ProductCell p={x} /> },
                            { key: 'a', label: 'საშუალო', align: 'right', render: (x) => <b>{x.avg.toFixed(1)}</b> },
                            { key: 'n', label: 'შეფ.', align: 'right', render: (x) => count(x.count) },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Section>
    </div>
  );
};

export default AdminAnalytics;
