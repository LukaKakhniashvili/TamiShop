import Icon from '../../Icon';
import { percent } from './format';

/** წინა პერიოდთან შედარება: change = % (null — წინა 0 იყო) */
export const ChangeBadge = ({ change, current, previous, format }) => {
  if (change == null) {
    if (!current) return <span className="an-change neutral">წინა პერიოდში: {format(previous ?? 0)}</span>;
    return <span className="an-change up">ახალი · წინა პერიოდში 0</span>;
  }
  const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  return (
    <span className={`an-change ${dir}`} title={`წინა პერიოდში: ${format(previous ?? 0)}`}>
      {dir !== 'neutral' && <Icon name={dir === 'up' ? 'arrowUp' : 'arrowDown'} size={13} strokeWidth={2.6} />}
      {change > 0 ? '+' : ''}
      {percent(change)} <span className="muted">წინა პერიოდთან</span>
    </span>
  );
};

/** KPI ბარათი — არსებული .stat სტილით */
const KpiCard = ({ icon, tone, label, value, hint, change, current, previous, format, loading }) => (
  <div className="card stat an-kpi" aria-busy={loading}>
    <span className={`stat-icon ${tone || ''}`}>
      <Icon name={icon} size={20} />
    </span>
    <div style={{ minWidth: 0 }}>
      <span>{label}</span>
      {loading ? (
        <div className="skeleton" style={{ height: 26, width: 120, marginTop: 4 }} />
      ) : (
        <>
          <strong>{value}</strong>
          {format && <ChangeBadge change={change} current={current} previous={previous} format={format} />}
          {hint && <small className="an-kpi-hint">{hint}</small>}
        </>
      )}
    </div>
  </div>
);

export default KpiCard;
