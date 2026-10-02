import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Icon from '../../components/Icon';
import { Stars } from '../../components/reviews/Stars';
import { useConfirm, useToast } from '../../context/UIContext';
import { Field, Loader, Pagination } from '../../components/ui';

/*
 * შეფასებების მოდერაცია (ადმინი / მენეჯერი): ნახვა, ძებნა/ფილტრი, დამალვა / აღდგენა.
 * შეფასება არ იშლება — დამალული საჯაროდ არ ჩანს და რეიტინგში არ ითვლება (სერვერი თავიდან ითვლის).
 */

const emptyFilters = { search: '', status: '', rating: '' };

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('ka-GE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const AdminReviews = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ reviews: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const loadData = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const { data: res } = await api.get('/review-admin-list', {
          params: { page, search: filters.search.trim() || undefined, status: filters.status || undefined, rating: filters.rating || undefined },
        });
        setData(res);
      } catch {
        toast({ type: 'error', title: 'შეფასებების ჩატვირთვა ვერ მოხერხდა' });
      } finally {
        setLoading(false);
      }
    },
    [filters, page, toast]
  );

  // მცირე დაყოვნება აკრეფისას
  useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  const setFilter = (key) => (e) => {
    setFilters({ ...filters, [key]: e.target.value });
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const moderate = async (r) => {
    const hide = r.status === 'published';
    const ok = await confirm({
      title: hide ? 'შეფასების დამალვა' : 'შეფასების აღდგენა',
      message: hide
        ? 'შეფასება საჯაროდ აღარ გამოჩნდება და პროდუქტის რეიტინგში აღარ ჩაითვლება. ის არ წაიშლება — შეგიძლიათ აღადგინოთ.'
        : 'შეფასება ხელახლა გამოქვეყნდება და პროდუქტის რეიტინგში ჩაითვლება.',
      confirmText: hide ? 'დამალვა' : 'აღდგენა',
      danger: hide,
      icon: hide ? 'eyeOff' : 'eye',
    });
    if (!ok) return;
    setBusyId(r._id);
    try {
      await api.put(`/review-${hide ? 'hide' : 'restore'}/${r._id}`);
      toast({ type: 'success', title: hide ? 'შეფასება დაიმალა' : 'შეფასება აღდგა', description: r.product?.name });
      await loadData({ quiet: true });
    } catch (err) {
      toast({ type: 'error', title: 'მოქმედება ვერ შესრულდა', description: err.response?.data?.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>შეფასებები</h1>
          <p>მომხმარებლების შეფასებები და მოდერაცია</p>
        </div>
      </div>

      <div className="card filters">
        <div className="filters-grid">
          <Field label="ძებნა">
            <div className="input-group">
              <span className="input-icon">
                <Icon name="search" size={16} />
              </span>
              <input
                className="input input-sm"
                type="search"
                placeholder="პროდუქტი, მომხმარებელი, ტექსტი..."
                value={filters.search}
                onChange={setFilter('search')}
              />
            </div>
          </Field>
          <Field label="სტატუსი">
            <select className="select input-sm" value={filters.status} onChange={setFilter('status')}>
              <option value="">ყველა</option>
              <option value="published">გამოქვეყნებული</option>
              <option value="hidden">დამალული</option>
            </select>
          </Field>
          <Field label="შეფასება">
            <select className="select input-sm" value={filters.rating} onChange={setFilter('rating')}>
              <option value="">ყველა</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ★
                </option>
              ))}
            </select>
          </Field>
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
        <>
          <div className="table-wrap">
            <table className="table admin-reviews-table">
              <thead>
                <tr>
                  <th>პროდუქტი</th>
                  <th>შეფასება</th>
                  <th>მომხმარებელი</th>
                  <th>სტატუსი</th>
                  <th className="right">მოქმედება</th>
                </tr>
              </thead>
              <tbody>
                {data.reviews.map((r, i) => {
                  const open = expanded === r._id;
                  return (
                    <tr key={r._id} style={{ animationDelay: `${i * 25}ms` }}>
                      <td>
                        {r.product ? (
                          <Link to={`/product/${r.product.slug || r.product._id}`} className="admin-review-product" target="_blank" rel="noopener">
                            {r.product.image && <img src={r.product.image} alt="" />}
                            <span className="strong">{r.product.name}</span>
                          </Link>
                        ) : (
                          <span className="muted">წაშლილი პროდუქტი</span>
                        )}
                      </td>
                      <td className="admin-review-body">
                        <div className="admin-review-meta">
                          <Stars value={r.rating} size={14} />
                          <span className="muted">
                            {formatDate(r.createdAt)}
                            {r.editedAt && ` · რედაქტ. ${formatDate(r.editedAt)}`}
                          </span>
                        </div>
                        <p className={`admin-review-text ${open ? 'open' : ''}`}>{r.comment}</p>
                        {r.comment.length > 140 && (
                          <button type="button" className="link" onClick={() => setExpanded(open ? null : r._id)}>
                            {open ? 'ნაკლები' : 'სრულად'}
                          </button>
                        )}
                      </td>
                      <td>
                        {r.user ? (
                          <>
                            <span className="strong">{r.user.name || '—'}</span>
                            <span className="sub">{r.user.email}</span>
                            {!r.user.isActive && <span className="pill pill-neutral no-dot">გამორთული</span>}
                          </>
                        ) : (
                          <span className="muted">წაშლილი მომხმარებელი</span>
                        )}
                        {r.verifiedPurchase && (
                          <span className="sub review-verified">
                            <Icon name="check" size={12} strokeWidth={3} /> ნაყიდი
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${r.status === 'published' ? 'pill-success' : 'pill-warning'}`}>
                          {r.status === 'published' ? 'გამოქვეყნებული' : 'დამალული'}
                        </span>
                        {r.moderatedAt && (
                          <span className="sub" title={formatDate(r.moderatedAt)}>
                            {r.moderatedBy || 'მოდერატორი'} · {new Date(r.moderatedAt).toLocaleDateString('ka-GE')}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className={`btn btn-sm ${r.status === 'published' ? 'btn-ghost' : ''}`}
                            onClick={() => moderate(r)}
                            disabled={busyId === r._id}
                          >
                            <Icon name={r.status === 'published' ? 'eyeOff' : 'eye'} size={16} />
                            {r.status === 'published' ? 'დამალვა' : 'აღდგენა'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.reviews.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty">
                      {hasFilters ? 'ფილტრით შეფასებები ვერ მოიძებნა' : 'შეფასებები ჯერ არ არის'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default AdminReviews;
