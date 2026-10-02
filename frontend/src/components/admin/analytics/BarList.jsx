import { bucketLabel } from './format';

/**
 * მარტივი განაწილება CSS ზოლებით (გრაფიკების ბიბლიოთეკის გარეშე) — სტატუსები, გადახდები, კატეგორიები, რეიტინგი.
 * items: [{ key, label, value, display, sub, note, tone }]; ზოლის სიგრძე — max-ის მიმართ, წილი — total-ის მიმართ.
 */
const BarList = ({ items, total, label }) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  const sum = total ?? items.reduce((a, i) => a + i.value, 0);
  return (
    <ul className="an-bars" aria-label={label}>
      {items.map((i) => {
        const share = sum ? Math.round((i.value / sum) * 1000) / 10 : 0;
        return (
          <li key={i.key} className="an-bar">
            <div className="an-bar-top">
              <span className="an-bar-label">
                {i.label}
                {i.note && <span className="an-bar-note">{i.note}</span>}
              </span>
              <span className="an-bar-value">
                <strong>{i.display ?? i.value}</strong>
                <span className="muted">{share}%</span>
              </span>
            </div>
            <span className="an-bar-track" aria-hidden="true">
              <span className={`an-bar-fill ${i.tone || ''}`} style={{ width: `${max ? (i.value / max) * 100 : 0}%` }} />
            </span>
            {i.sub && <span className="an-bar-sub">{i.sub}</span>}
          </li>
        );
      })}
    </ul>
  );
};

/**
 * მცირე სვეტოვანი დიაგრამა (CSS) — მაგ. შეფასებები დროში. თითო სვეტზე hover/ფოკუსი აჩვენებს მნიშვნელობას.
 * data: [{ t, count }]
 */
export const ColumnBars = ({ data = [], granularity, label }) => {
  const max = Math.max(0, ...data.map((d) => d.count));
  const first = data[0];
  const last = data[data.length - 1];
  return (
    <figure className="an-columns" aria-label={label}>
      <div className="an-columns-plot">
        {data.map((d) => {
          const text = `${bucketLabel(d.t, granularity, true)}: ${d.count}`;
          return (
            <span key={d.t} className="an-col" role="img" tabIndex={0} aria-label={text} data-tip={text}>
              <span className="an-col-fill" style={{ height: `${max ? Math.max(d.count ? 4 : 0, (d.count / max) * 100) : 0}%` }} />
            </span>
          );
        })}
      </div>
      {first && (
        <figcaption className="an-columns-axis">
          <span>{bucketLabel(first.t, granularity)}</span>
          <span>{bucketLabel(last.t, granularity)}</span>
        </figcaption>
      )}
    </figure>
  );
};

export default BarList;
