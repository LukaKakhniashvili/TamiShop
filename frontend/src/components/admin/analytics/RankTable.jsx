import { Link } from 'react-router-dom';

/**
 * რეიტინგის ცხრილი (არსებული .table / .table-wrap) — ვიწრო ეკრანზე ცხრილი კონტეინერში სქროლდება,
 * გვერდი კი არა. columns: [{ key, label, render, align }]
 */
const RankTable = ({ rows, columns, rowKey, label, numbered = true }) => (
  <div className="table-wrap an-table">
    <table className="table" aria-label={label}>
      <thead>
        <tr>
          {numbered && <th className="an-rank">#</th>}
          {columns.map((c) => (
            <th key={c.key} className={c.align === 'right' ? 'right' : undefined}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={rowKey(r, i)}>
            {numbered && <td className="an-rank muted">{i + 1}</td>}
            {columns.map((c) => (
              <td key={c.key} className={c.align === 'right' ? 'right nowrap' : undefined}>
                {c.render(r)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** პროდუქტის უჯრა: სურათი + სახელი (ბმული) + ნიშნები (წაშლილი / არააქტიური) */
export const ProductCell = ({ p }) => {
  const body = (
    <>
      {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="an-thumb-empty" aria-hidden="true" />}
      <span className="an-product-name">
        <span className="strong">{p.name || 'უცნობი პროდუქტი'}</span>
        {p.deleted && <span className="pill pill-neutral no-dot">წაშლილი</span>}
        {!p.deleted && p.isActive === false && <span className="pill pill-warning no-dot">არააქტიური</span>}
      </span>
    </>
  );
  return p.slug && !p.deleted ? (
    <Link to={`/product/${p.slug}`} className="an-product" target="_blank" rel="noopener">
      {body}
    </Link>
  ) : (
    <span className="an-product">{body}</span>
  );
};

export default RankTable;
