import Icon from '../../Icon';

/**
 * ანალიტიკის სექცია: სათაური + ნიშნები (მაგ. „მიმდინარე მდგომარეობა", „შეფასებითი") და
 * ჩატვირთვის / შეცდომის (ხელახლა ცდით) / ცარიელი მდგომარეობები — თითოეული სექცია დამოუკიდებელია.
 */
const Section = ({ id, title, subtitle, badges = [], status, error, onRetry, empty, emptyText, skeleton = 180, children, className = '' }) => (
  <section className={`card an-section ${className}`} id={id} aria-labelledby={id ? `${id}-title` : undefined} aria-busy={status === 'loading' || status === 'refreshing'}>
    <header className="an-section-head">
      <div>
        <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {badges.length > 0 && (
        <div className="an-badges">
          {badges.map((b) => (
            <span key={b.label} className={`pill no-dot ${b.tone || 'pill-neutral'}`} title={b.title}>
              {b.icon && <Icon name={b.icon} size={13} />} {b.label}
            </span>
          ))}
        </div>
      )}
    </header>
    {status === 'loading' ? (
      <div className="skeleton" style={{ height: skeleton, borderRadius: 14 }} />
    ) : status === 'error' ? (
      <div className="an-state an-error" role="alert">
        <Icon name="alert" size={20} />
        <span>{error || 'მონაცემების ჩატვირთვა ვერ მოხერხდა'}</span>
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={15} /> ხელახლა ცდა
        </button>
      </div>
    ) : empty ? (
      <div className="an-state">
        <Icon name="info" size={20} />
        <span>{emptyText || 'ამ პერიოდში მონაცემები არ არის'}</span>
      </div>
    ) : (
      <div className={status === 'refreshing' ? 'an-refreshing' : undefined}>{children}</div>
    )}
  </section>
);

export default Section;
