import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bucketLabel } from './format';

/*
 * დროითი გრაფიკი (Recharts — მხოლოდ ანალიტიკის chunk-ში).
 * ფერები თემის ცვლადებიდან (--series-1/2, ვალიდირებული ღია/მუქ ზედაპირზე) — მუქი თემა ავტომატურია.
 * ზედ-დაწყობილი სვეტები (დისკრეტული პერიოდები — გლუვი მრუდი დღეებს შორის მნიშვნელობებს „იგონებს"):
 * ორი სერია, ერთი ღერძი (ერთი ერთეული), ნაწილები ჯამდება მთლიანად.
 * ლეგენდა ყოველთვის ჩანს; hover — პერიოდის ზოლის მონიშვნა + tooltip; ცხრილის ხედი — <details>.
 */

const TooltipBox = ({ active, payload, label, granularity, series, format }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const total = series.reduce((a, s) => a + (row[s.key] || 0), 0);
  return (
    <div className="an-tooltip">
      <strong>{bucketLabel(label, granularity, true)}</strong>
      {series.map((s) => (
        <div key={s.key} className="an-tooltip-row">
          <span className="an-swatch" style={{ background: s.color }} />
          <span>{s.label}</span>
          <b>{format(row[s.key] || 0)}</b>
        </div>
      ))}
      {series.length > 1 && (
        <div className="an-tooltip-row an-tooltip-total">
          <span />
          <span>სულ</span>
          <b>{format(total)}</b>
        </div>
      )}
    </div>
  );
};

const TimeSeriesChart = ({ data, granularity, series, format, axisFormat, label, height = 260 }) => {
  const axis = { stroke: 'var(--border)', tick: { fill: 'var(--muted)', fontSize: 12 }, tickLine: false };
  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const xAxis = (
    <XAxis dataKey="t" {...axis} tickFormatter={(v) => bucketLabel(v, granularity)} minTickGap={24} interval="preserveStartEnd" />
  );
  const yAxis = <YAxis {...axis} axisLine={false} width={56} tickFormatter={axisFormat || format} allowDecimals={false} />;
  const grid = <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />;
  const tooltip = (
    <Tooltip
      cursor={{ fill: 'var(--surface-2)' }}
      content={<TooltipBox granularity={granularity} series={series} format={format} />}
      isAnimationActive={false}
    />
  );

  return (
    <figure className="an-chart">
      <figcaption className="an-legend">
        {series.map((s) => (
          <span key={s.key}>
            <span className="an-swatch" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </figcaption>
      <div className="an-chart-area" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart {...common} barCategoryGap="22%">
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={1}
                maxBarSize={36}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="an-table-view">
        <summary>მონაცემები ცხრილით</summary>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>პერიოდი</th>
                {series.map((s) => (
                  <th key={s.key} className="right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.t}>
                  <td className="nowrap">{bucketLabel(r.t, granularity, true)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="right nowrap">
                      {format(r[s.key] || 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};

export default TimeSeriesChart;
