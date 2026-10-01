import { Fragment, useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import { useToast } from '../../context/UIContext';
import { Field, Loader, Pagination, formatPrice } from '../../components/ui';
import {
  orderStatuses as statuses,
  paymentMethodLabels,
  paymentStatusLabels,
  paymentStatusPill,
  statusLabels,
} from '../../constants';

const PAGE_SIZE = 20;
const emptyFilters = { orderNumber: '', phone: '', minPrice: '', maxPrice: '', status: '', startDate: '', endDate: '' };

// API აბრუნებს { orders, total, pages, stats }; ძველი სერვერი — უბრალო მასივს. ორივე შემთხვევაში გვერდი არ უნდა დაიშალოს.
const normalizeOrdersResponse = (res) => {
  const orders = Array.isArray(res) ? res : Array.isArray(res?.orders) ? res.orders : [];
  const stats = res?.stats || {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    revenue: orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + (o.totalPrice || 0), 0),
  };
  return { orders, total: res?.total ?? orders.length, pages: res?.pages || 1, stats };
};

const AdminOrders = () => {
  const toast = useToast();
  const [data, setData] = useState({ orders: [], total: 0, pages: 1, stats: { total: 0, pending: 0, revenue: 0 } });
  const orders = data.orders;
  const stats = data.stats;
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  // ფილტრაცია და გვერდები სერვერზე (GET /api/order-list) — ყველა ფილტრი ერთად მუშაობს
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/order-list', {
        params: {
          page,
          limit: PAGE_SIZE,
          orderNumber: filters.orderNumber || undefined,
          phone: filters.phone || undefined,
          status: filters.status || undefined,
          minPrice: filters.minPrice || undefined,
          maxPrice: filters.maxPrice || undefined,
          from: filters.startDate || undefined,
          to: filters.endDate || undefined,
        },
      });
      setData(normalizeOrdersResponse(res));
    } catch (err) {
      toast({ type: 'error', title: 'შეკვეთების ჩატვირთვა ვერ მოხერხდა' });
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  // მცირე დაყოვნება აკრეფისას, რომ ყოველ სიმბოლოზე მოთხოვნა არ გაიგზავნოს
  useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  const handleStatusChange = async (id, status) => {
    const previous = data;
    setData((d) => ({ ...d, orders: d.orders.map((o) => (o._id === id ? { ...o, status } : o)) }));
    try {
      await api.put(`/order-status-update/${id}`, { status });
      toast({ title: 'სტატუსი განახლდა', description: statusLabels[status] });
    } catch (err) {
      setData(previous);
      toast({ type: 'error', title: 'სტატუსის განახლება ვერ მოხერხდა' });
    }
  };

  const setFilter = (key) => (e) => {
    setFilters({ ...filters, [key]: e.target.value });
    setPage(1);
  };
  const filteredOrders = orders;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>შეკვეთები</h1>
          <p>თვალი ადევნეთ და მართეთ შემოსული შეკვეთები</p>
        </div>
        <button className="btn btn-sm" onClick={loadData} disabled={loading}>
          <Icon name="refresh" size={16} /> განახლება
        </button>
      </div>

      <div className="stats">
        <div className="card stat reveal" style={{ '--i': 0 }}>
          <span className="stat-icon"><Icon name="receipt" size={20} /></span>
          <div>
            <span>სულ შეკვეთა</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        <div className="card stat reveal" style={{ '--i': 1 }}>
          <span className="stat-icon warn"><Icon name="alert" size={20} /></span>
          <div>
            <span>მოლოდინში</span>
            <strong>{stats.pending}</strong>
          </div>
        </div>
        <div className="card stat reveal" style={{ '--i': 2 }}>
          <span className="stat-icon ok"><Icon name="card" size={20} /></span>
          <div>
            <span>შემოსავალი</span>
            <strong>{formatPrice(stats.revenue)}</strong>
          </div>
        </div>
      </div>

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
        {hasFilters && (
          <div className="filters-actions">
            <span className="muted" style={{ marginRight: 'auto', fontSize: 13, alignSelf: 'center' }}>
              ნაპოვნია {data.total} შეკვეთა
            </span>
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
          </div>
        )}
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>შეკვეთა</th>
                <th>კლიენტი</th>
                <th>მისამართი</th>
                <th className="right">ჯამი</th>
                <th>გადახდა</th>
                <th>სტატუსი</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o, i) => {
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
                      <td className="nowrap">
                        <span className="strong">{o.orderNumber || `#${o._id.slice(-6).toUpperCase()}`}</span>
                        <span className="sub">{new Date(o.createdAt).toLocaleDateString('ka-GE')}</span>
                      </td>
                      <td>
                        <span className="strong">
                          {o.customerInfo.firstName} {o.customerInfo.lastName}
                        </span>
                        <span className="sub">{o.customerInfo.phone}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {o.customerInfo.address.city}, {o.customerInfo.address.street}
                      </td>
                      <td className="right strong nowrap">{formatPrice(o.totalPrice)}</td>
                      <td>
                        {o.payment?.status ? (
                          <span className={`pill ${paymentStatusPill[o.payment.status] || 'pill-neutral'}`}>
                            {paymentMethodLabels[o.payment.method]} · {paymentStatusLabels[o.payment.status]}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                        {o.payment?.refundRequired && (
                          <span className="pill pill-danger" style={{ marginTop: 4, display: 'flex', width: 'fit-content' }}>
                            საჭიროა დაბრუნება
                          </span>
                        )}
                      </td>
                      <td>
                        <select
                          className={`status-select status-${o.status}`}
                          value={o.status}
                          onChange={(e) => handleStatusChange(o._id, e.target.value)}
                          aria-label="სტატუსი"
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {statusLabels[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {open && (
                      <tr className="order-expand">
                        <td colSpan="7">
                          <div className="inner">
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
                            {o.payment?.failureReason && <span className="field-error">გადახდის შეცდომა: {o.payment.failureReason}</span>}
                            {o.items.map((it, idx) => (
                              <div key={idx}>
                                <span>
                                  {it.name} <span className="muted">× {it.quantity}</span>
                                </span>
                                <strong>{formatPrice(it.price * it.quantity)}</strong>
                              </div>
                            ))}
                            {o.user?.email && <span className="muted">ანგარიში: {o.user.email}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty">
                    {filters.orderNumber
                      ? `შეკვეთა ნომრით „${filters.orderNumber}" ვერ მოიძებნა`
                      : 'შეკვეთები ვერ მოიძებნა'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={data.pages} onChange={setPage} />
    </div>
  );
};

export default AdminOrders;
