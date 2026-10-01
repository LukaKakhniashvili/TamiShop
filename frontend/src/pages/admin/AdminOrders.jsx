import { Fragment, useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import { useToast } from '../../context/UIContext';
import { Field, Loader, Pagination, formatPrice } from '../../components/ui';
import OrderManageModal, { orderNo } from '../../components/admin/OrderManageModal';
import LineOptions from '../../components/LineOptions';
import {
  orderStatuses as statuses,
  paymentMethodLabels,
  paymentStatusLabels,
  statusLabels,
  statusPill,
} from '../../constants';

// გვერდზე ზუსტად 10 შეკვეთა; ფილტრაცია, გვერდები და სტატისტიკა — სერვერზე
const PAGE_SIZE = 10;
const emptyFilters = { orderNumber: '', phone: '', minPrice: '', maxPrice: '', status: '', startDate: '', endDate: '' };
const emptyStats = {
  total: 0,
  byStatus: { pending: 0, processing: 0, shipped: 0, completed: 0, cancelled: 0 },
  values: { completed: 0, inProgress: 0, activeTotal: 0, cancelled: 0 },
};

// ფილტრები → API პარამეტრები (ერთი და იგივე სიისთვის და Excel ექსპორტისთვის)
const filterParams = (f) => ({
  orderNumber: f.orderNumber || undefined,
  phone: f.phone || undefined,
  status: f.status || undefined,
  minPrice: f.minPrice || undefined,
  maxPrice: f.maxPrice || undefined,
  from: f.startDate || undefined,
  to: f.endDate || undefined,
});

const formatDate = (d) => new Date(d).toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' });
const formatTime = (d) => new Date(d).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });

const COUNT_CARDS = [
  { key: 'total', label: 'სულ შეკვეთა', icon: 'receipt' },
  { key: 'pending', label: statusLabels.pending, icon: 'clock' },
  { key: 'processing', label: statusLabels.processing, icon: 'refresh' },
  { key: 'shipped', label: statusLabels.shipped, icon: 'truck' },
  { key: 'completed', label: statusLabels.completed, icon: 'check' },
  { key: 'cancelled', label: statusLabels.cancelled, icon: 'x' },
];

const OrderStats = ({ stats }) => {
  const { values, byStatus } = stats;
  const completedShare = values.activeTotal > 0 ? (values.completed / values.activeTotal) * 100 : 0;
  return (
    <section className="order-stats" aria-label="შეკვეთების სტატისტიკა">
      <div className="order-count-grid">
        {COUNT_CARDS.map((c, i) => (
          <div key={c.key} className={`card order-count status-tone-${c.key} reveal`} style={{ '--i': i }}>
            <span className="order-count-icon" aria-hidden="true">
              <Icon name={c.icon} size={16} />
            </span>
            <span className="order-count-label">{c.label}</span>
            <strong>{c.key === 'total' ? stats.total : byStatus[c.key] ?? 0}</strong>
          </div>
        ))}
      </div>

      <div className="order-value-grid">
        <div className="card order-value reveal" style={{ '--i': 6 }}>
          <div className="order-value-head">
            <span>აქტიური + დასრულებული შეკვეთების ღირებულება</span>
            <strong>{formatPrice(values.activeTotal)}</strong>
          </div>
          <div
            className="value-bar"
            role="img"
            aria-label={`დასრულებული ${Math.round(completedShare)}%, მიმდინარე ${Math.round(100 - completedShare)}%`}
          >
            <span className="value-bar-completed" style={{ width: `${completedShare}%` }} />
            <span className="value-bar-progress" style={{ width: `${values.activeTotal > 0 ? 100 - completedShare : 0}%` }} />
          </div>
          <dl className="value-rows">
            <div className="value-row tone-success">
              <dt>
                <span className="value-dot" aria-hidden="true" /> დასრულებული (შემოსავალი)
                <small>{byStatus.completed} შეკვეთა</small>
              </dt>
              <dd>{formatPrice(values.completed)}</dd>
            </div>
            <div className="value-row tone-warning">
              <dt>
                <span className="value-dot" aria-hidden="true" /> მიმდინარე — მოლოდინში, მუშავდება, გაგზავნილი
                <small>{byStatus.pending + byStatus.processing + byStatus.shipped} შეკვეთა</small>
              </dt>
              <dd>{formatPrice(values.inProgress)}</dd>
            </div>
          </dl>
        </div>

        <div className="card order-value order-value-cancelled reveal" style={{ '--i': 7 }}>
          <div className="order-value-head">
            <span>
              <span className="value-dot" aria-hidden="true" /> გაუქმებული შეკვეთების ღირებულება
            </span>
            <strong>{formatPrice(values.cancelled)}</strong>
          </div>
          <p className="muted">
            {byStatus.cancelled} გაუქმებული შეკვეთა · არ შედის შემოსავალში
          </p>
        </div>
      </div>
      <p className="order-stats-note muted">სტატისტიკა ითვლის ყველა დადასტურებულ შეკვეთას (ფილტრებისა და გვერდების გარეშე).</p>
    </section>
  );
};

const AdminOrders = () => {
  const toast = useToast();
  const [data, setData] = useState({ orders: [], total: 0, page: 1, pages: 1, stats: emptyStats });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [managing, setManaging] = useState(null); // შეკვეთა, რომლის მართვის ფანჯარაც ღიაა
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data: res } = await api.get('/order-list', { params: { page, limit: PAGE_SIZE, ...filterParams(filters) } });
        setData({ ...res, stats: res.stats?.byStatus ? res.stats : emptyStats });
        if (res.page && res.page !== page) setPage(res.page);
      } catch (err) {
        toast({ type: 'error', title: 'შეკვეთების ჩატვირთვა ვერ მოხერხდა' });
      } finally {
        setLoading(false);
      }
    },
    [filters, page, toast]
  );

  // მცირე დაყოვნება აკრეფისას, რომ ყოველ სიმბოლოზე მოთხოვნა არ გაიგზავნოს
  useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  const setFilter = (key) => (e) => {
    setFilters({ ...filters, [key]: e.target.value });
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  // მართვის ფანჯარაში შესრულებული მოქმედების შემდეგ: შეტყობინება + სია, სტატისტიკა და შემოსავალი თავიდან
  const onManaged = async (title) => {
    const o = managing;
    setManaging(null);
    toast({ type: 'success', title, description: o ? orderNo(o) : undefined });
    await loadData({ quiet: true });
  };

  // Excel — მიმდინარე ფილტრებით, გვერდების გარეშე (ყველა შესაბამისი შეკვეთა)
  const downloadOrders = async () => {
    setExporting(true);
    try {
      const res = await api.get('/order-export', { params: filterParams(filters), responseType: 'blob' });
      const disposition = res.headers['content-disposition'] || '';
      const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition) || /filename="([^"]+)"/i.exec(disposition);
      const fileName = match ? decodeURIComponent(match[1]) : `Tami Orders - ${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ type: 'success', title: 'ფაილი ჩამოიტვირთა', description: `${res.headers['x-export-count'] ?? ''} შეკვეთა · ${fileName}` });
    } catch (err) {
      let message;
      try {
        message = JSON.parse(await err.response?.data?.text())?.message;
      } catch {
        /* არა-JSON პასუხი */
      }
      toast({ type: 'error', title: 'ჩამოტვირთვა ვერ მოხერხდა', description: message });
    } finally {
      setExporting(false);
    }
  };

  const from = data.total ? (data.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(data.total, data.page * PAGE_SIZE);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>შეკვეთები</h1>
          <p>თვალი ადევნეთ და მართეთ შემოსული შეკვეთები</p>
        </div>
        <div className="admin-head-actions">
          <button className="btn btn-sm" onClick={() => loadData()} disabled={loading}>
            <Icon name="refresh" size={16} /> განახლება
          </button>
          <button className="btn btn-sm btn-primary" onClick={downloadOrders} disabled={exporting || !data.total}>
            {exporting ? <span className="spinner" /> : <Icon name="download" size={16} />} შეკვეთების ჩამოტვირთვა
          </button>
        </div>
      </div>

      <OrderStats stats={data.stats} />

      <div className="card filters">
        <div className="filters-grid">
          <Field label="შეკვეთის ნომერი">
            <div className="input-group">
              <span className="input-icon">
                <Icon name="search" size={16} />
              </span>
              <input
                className="input input-sm"
                type="search"
                placeholder="TM-261001-89A95"
                value={filters.orderNumber}
                onChange={setFilter('orderNumber')}
                autoFocus
              />
            </div>
          </Field>
          <Field label="ტელეფონი">
            <input className="input input-sm" type="text" placeholder="ნომერი..." value={filters.phone} onChange={setFilter('phone')} />
          </Field>
          <Field label="მინ. ჯამი">
            <input className="input input-sm" type="number" placeholder="0" value={filters.minPrice} onChange={setFilter('minPrice')} />
          </Field>
          <Field label="მაქს. ჯამი">
            <input className="input input-sm" type="number" placeholder="∞" value={filters.maxPrice} onChange={setFilter('maxPrice')} />
          </Field>
          <Field label="სტატუსი">
            <select className="select input-sm" value={filters.status} onChange={setFilter('status')}>
              <option value="">ყველა</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="თარიღიდან">
            <input className="input input-sm" type="date" value={filters.startDate} onChange={setFilter('startDate')} />
          </Field>
          <Field label="თარიღამდე">
            <input className="input input-sm" type="date" value={filters.endDate} onChange={setFilter('endDate')} />
          </Field>
        </div>
        <div className="filters-actions">
          <span className="muted list-range" aria-live="polite">
            {data.total ? `ნაჩვენებია ${from}–${to} / ${data.total} შეკვეთა` : 'შეკვეთები არ მოიძებნა'}
            {hasFilters && ' (გაფილტრული)'}
          </span>
          {hasFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFilters(emptyFilters);
                setPage(1);
              }}
            >
              <Icon name="x" size={16} /> გასუფთავება
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="table-wrap">
          <table className="table orders-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>შეკვეთა</th>
                <th>თარიღი</th>
                <th>სახელი და გვარი</th>
                <th>ტელეფონი</th>
                <th className="right">ჯამი</th>
                <th>სტატუსი</th>
                <th className="right">სტატუსის მართვა</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o, i) => {
                const open = expanded === o._id;
                return (
                  <Fragment key={o._id}>
                    <tr style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}>
                      <td>
                        <button
                          className={`icon-btn expand-btn ${open ? 'open' : ''}`}
                          style={{ width: 32, height: 32 }}
                          onClick={() => setExpanded(open ? null : o._id)}
                          aria-expanded={open}
                          aria-label="დეტალები"
                        >
                          <Icon name="chevronRight" size={16} />
                        </button>
                      </td>
                      <td className="nowrap" data-label="შეკვეთა">
                        <span className="strong">{orderNo(o)}</span>
                      </td>
                      <td className="nowrap" data-label="თარიღი">
                        {formatDate(o.createdAt)}
                        <span className="sub">{formatTime(o.createdAt)}</span>
                      </td>
                      <td data-label="სახელი და გვარი">
                        <span className="strong">
                          {o.customerInfo.firstName} {o.customerInfo.lastName}
                        </span>
                      </td>
                      <td className="nowrap" data-label="ტელეფონი">
                        <a className="phone-link" href={`tel:${o.customerInfo.phone.replace(/\s+/g, '')}`}>
                          {o.customerInfo.phone}
                        </a>
                      </td>
                      <td className="right strong nowrap" data-label="ჯამი">
                        {formatPrice(o.totalPrice)}
                      </td>
                      <td data-label="სტატუსი">
                        <span className={`pill ${statusPill[o.status] || 'pill-neutral'}`}>{statusLabels[o.status] || o.status}</span>
                        {/* გადახდა — კომპაქტურად სტატუსის ქვეშ (სრული ინფორმაცია: მართვის ფანჯარა / დეტალები) */}
                        {o.payment?.status && (
                          <span className="sub order-payment-line">
                            {paymentMethodLabels[o.payment.method]} · {paymentStatusLabels[o.payment.status]}
                          </span>
                        )}
                        {o.payment?.refundRequired && <span className="pill pill-danger order-refund">საჭიროა დაბრუნება</span>}
                      </td>
                      <td className="right order-actions-cell">
                        <button
                          type="button"
                          className="btn btn-sm order-manage-btn"
                          onClick={() => setManaging(o)}
                          aria-haspopup="dialog"
                          aria-label={`შეკვეთის ${orderNo(o)} მართვა`}
                        >
                          <Icon name="edit" size={14} /> მართვა
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="order-expand">
                        <td colSpan="8">
                          <div className="inner">
                            <span className="muted">
                              მისამართი: {o.customerInfo.address.city}, {o.customerInfo.address.street}
                              {o.customerInfo.address.postalCode ? `, ${o.customerInfo.address.postalCode}` : ''}
                            </span>
                            {o.delivery?.method && (
                              <span className="muted">
                                მიწოდება: სტანდარტული · {o.delivery.cost > 0 ? formatPrice(o.delivery.cost) : 'უფასო'} · {o.delivery.estimate}
                              </span>
                            )}
                            {o.payment?.provider && (
                              <span className="muted">
                                ბანკი: {o.payment.provider}
                                {o.payment.mode === 'sandbox' ? ' (სატესტო)' : ''}
                                {o.payment.cardLast4 ? ` · ბარათი •••• ${o.payment.cardLast4}` : ''}
                                {o.payment.transactionId ? ` · ტრანზაქცია ${o.payment.transactionId}` : ''}
                              </span>
                            )}
                            {o.payment?.failureReason && <span className="field-error">გადახდის შენიშვნა: {o.payment.failureReason}</span>}
                            {o.payment?.status && (
                              <span className="muted">
                                გადახდა: {paymentMethodLabels[o.payment.method]} · {paymentStatusLabels[o.payment.status]}
                              </span>
                            )}
                            <ul className="order-items" aria-label="შეკვეთილი პროდუქტები">
                              {o.items.map((it, idx) => (
                                <li key={idx}>
                                  <span>
                                    {/* შეკვეთაში შენახული სახელი; ბმული მხოლოდ არსებულ პროდუქტზე (წაშლილზე — ტექსტი) */}
                                    {it.productLink ? (
                                      <a
                                        className="product-link"
                                        href={it.productLink.path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="პროდუქტის გვერდი ახალ ჩანართში"
                                      >
                                        {it.name}
                                        <Icon name="external" size={12} />
                                        <span className="sr-only"> (იხსნება ახალ ჩანართში)</span>
                                      </a>
                                    ) : (
                                      <span title="პროდუქტი წაშლილია — გვერდი აღარ არსებობს">{it.name}</span>
                                    )}{' '}
                                    <span className="muted">× {it.quantity}</span>
                                    <LineOptions options={it.variant?.options} />
                                    {it.variant?.sku && <span className="muted order-item-sku">SKU: {it.variant.sku}</span>}
                                    {!it.productLink && <span className="pill pill-neutral no-dot order-item-note">წაშლილია</span>}
                                    {it.productLink && !it.productLink.active && (
                                      <span className="pill pill-neutral no-dot order-item-note">დამალულია</span>
                                    )}
                                  </span>
                                  <strong>{formatPrice(it.price * it.quantity)}</strong>
                                </li>
                              ))}
                            </ul>
                            {o.user?.email && <span className="muted">ანგარიში: {o.user.email}</span>}
                            {o.statusHistory?.length > 0 && (
                              <span className="muted">
                                ისტორია:{' '}
                                {o.statusHistory
                                  .map((h) => `${statusLabels[h.to]} (${formatDate(h.at)} ${formatTime(h.at)})`)
                                  .join(' → ')}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data.orders.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty">
                    {filters.orderNumber ? `შეკვეთა ნომრით „${filters.orderNumber}" ვერ მოიძებნა` : 'შეკვეთები ვერ მოიძებნა'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page || page} totalPages={data.pages} onChange={setPage} />

      {managing && <OrderManageModal order={managing} onClose={() => setManaging(null)} onDone={onManaged} />}
    </div>
  );
};

export default AdminOrders;
