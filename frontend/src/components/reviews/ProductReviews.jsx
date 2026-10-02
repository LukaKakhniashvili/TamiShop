import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { apiErrorMessage } from '../../i18n/errors';
import { formatDate } from '../../i18n/content';
import Icon from '../Icon';
import { EmptyState } from '../ui';
import ReviewForm from './ReviewForm';
import { Stars } from './Stars';

const SORTS = ['newest', 'highest', 'lowest'];
const PAGE_SIZE = 10;

/** საშუალო + განაწილება (5★…1★); ზოლი = ფილტრი (ხელახლა დაჭერა — მოხსნა) */
const ReviewSummary = ({ summary, filter, onFilter }) => {
  const { t } = useTranslation();
  return (
    <div className="review-summary">
      <div className="review-average">
        <strong className="review-average-num">{summary.count ? summary.average.toFixed(1) : '—'}</strong>
        <Stars value={summary.average} size={18} />
        <span className="muted">{t('reviews.totalReviews', { count: summary.count })}</span>
      </div>
      <ul className="review-bars" aria-label={t('reviews.distribution')}>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = summary.distribution?.[star] || 0;
          const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
          return (
            <li key={star}>
              <button
                type="button"
                className={`review-bar ${filter === star ? 'active' : ''}`}
                onClick={() => onFilter(filter === star ? null : star)}
                disabled={!n && filter !== star}
                aria-pressed={filter === star}
                aria-label={t('reviews.barLabel', { star, count: n, percent: pct })}
              >
                <span className="review-bar-star">
                  {star} <Icon name="star" size={12} strokeWidth={0} />
                </span>
                <span className="review-bar-track">
                  <span className="review-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="review-bar-pct">{pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ReviewItem = ({ review, own }) => {
  const { t } = useTranslation();
  return (
    <li className="review-item">
      <div className="review-item-head">
        <Stars value={review.rating} size={15} />
        {own && <span className="pill pill-accent no-dot">{t('reviews.yourReview')}</span>}
      </div>
      <div className="review-item-meta">
        <strong>{review.author || t('reviews.anonymous')}</strong>
        {review.verifiedPurchase && (
          <span className="review-verified">
            <Icon name="check" size={13} strokeWidth={3} /> {t('reviews.verifiedPurchase')}
          </span>
        )}
        <span className="muted">
          <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
          {review.editedAt && ` · ${t('reviews.edited')}`}
        </span>
      </div>
      {/* მომხმარებლის ტექსტი — როგორც დაიწერა (ავტომატურად არ ითარგმნება) */}
      <p className="review-item-text">{review.comment}</p>
    </li>
  );
};

/**
 * Product Details → შეფასებები. სორტირება / გვერდები / განაწილება — სერვერზე.
 * მუტაციის შემდეგ ყველაფერი სერვერიდან ახლდება (ოპტიმისტური მდგომარეობა არ რჩება).
 */
const ProductReviews = ({ productId, productName, onSummaryChange }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState({ reviews: [], page: 0, pages: 0, total: 0 });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState('newest');
  const [filter, setFilter] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [form, setForm] = useState(null); // null | { review }
  const [deleting, setDeleting] = useState(false);
  const requestRef = useRef(0);
  const sectionRef = useRef(null);
  const scrolledRef = useRef(false);

  const fetchPage = useCallback(
    (page) => api.get(`/review-list/${productId}`, { params: { sort, page, limit: PAGE_SIZE, rating: filter || undefined } }).then((r) => r.data),
    [productId, sort, filter]
  );

  const loadSummary = useCallback(async () => {
    const { data } = await api.get(`/review-summary/${productId}`);
    setSummary(data);
    onSummaryChange?.({ rating: data.average, reviewCount: data.count });
  }, [productId, onSummaryChange]);

  const loadEligibility = useCallback(async () => {
    if (!user) return setEligibility(null);
    try {
      const { data } = await api.get(`/review-eligibility/${productId}`);
      setEligibility(data);
    } catch {
      setEligibility(null);
    }
  }, [productId, user]);

  const reload = useCallback(async () => {
    const id = ++requestRef.current;
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const [page] = await Promise.all([fetchPage(1), loadSummary()]);
      if (id !== requestRef.current) return;
      setList(page);
      setStatus('ready');
    } catch {
      if (id === requestRef.current) setStatus('error');
    }
  }, [fetchPage, loadSummary]);

  // პროდუქტის შეცვლისას — სუფთა მდგომარეობა
  useEffect(() => {
    setSort('newest');
    setFilter(null);
    setSummary(null);
    setStatus('loading');
    scrolledRef.current = false;
  }, [productId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  // #reviews (შესვლის შემდეგ / ბმულიდან) — სექციამდე ჩამოსვლა
  useEffect(() => {
    if (status !== 'ready' || scrolledRef.current || location.hash !== '#reviews') return;
    scrolledRef.current = true;
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [status, location.hash]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const id = requestRef.current;
    try {
      const next = await fetchPage(list.page + 1);
      if (id !== requestRef.current) return;
      setList((prev) => {
        const seen = new Set(prev.reviews.map((r) => r._id));
        return { ...next, reviews: [...prev.reviews, ...next.reviews.filter((r) => !seen.has(r._id))] };
      });
    } catch (err) {
      toast({ type: 'error', title: apiErrorMessage(err, 'reviews.loadFailed') });
    } finally {
      setLoadingMore(false);
    }
  };

  const afterChange = async () => {
    setForm(null);
    await Promise.all([reload(), loadEligibility()]);
  };

  const removeOwn = async () => {
    const own = eligibility?.review;
    if (!own || deleting) return;
    const ok = await confirm({
      title: t('reviews.deleteConfirmTitle'),
      message: t('reviews.deleteConfirmText'),
      confirmText: t('reviews.deleteReview'),
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/review-delete/${own._id}`);
      toast({ type: 'success', title: t('reviews.reviewDeleted') });
      await afterChange();
    } catch (err) {
      toast({ type: 'error', title: apiErrorMessage(err, 'reviews.deleteFailed') });
      loadEligibility();
    } finally {
      setDeleting(false);
    }
  };

  const ownId = eligibility?.review?._id;
  const ownHidden = eligibility?.review?.status === 'hidden';

  const actions = () => {
    if (!user) {
      return (
        <Link to="/login" state={{ from: `${location.pathname}${location.search}#reviews` }} className="btn btn-sm">
          <Icon name="login" size={16} /> {t('reviews.loginToReview')}
        </Link>
      );
    }
    if (!eligibility) return null;
    if (eligibility.canReview) {
      return (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ review: null })}>
          <Icon name="edit" size={16} /> {t('reviews.writeReview')}
        </button>
      );
    }
    if (eligibility.review) {
      return (
        <div className="review-own-actions">
          <button type="button" className="btn btn-sm" onClick={() => setForm({ review: eligibility.review })}>
            <Icon name="edit" size={16} /> {t('reviews.editReview')}
          </button>
          <button type="button" className="btn btn-ghost btn-sm review-delete" onClick={removeOwn} disabled={deleting}>
            <Icon name="trash" size={16} /> {t('reviews.deleteReview')}
          </button>
        </div>
      );
    }
    return null;
  };

  const note = () => {
    if (!user || !eligibility) return null;
    if (ownHidden) return <p className="review-note warning"><Icon name="info" size={15} /> {t('reviews.hiddenNote')}</p>;
    if (eligibility.reason === 'ALREADY_REVIEWED') return <p className="review-note"><Icon name="check" size={15} /> {t('reviews.alreadyReviewed')}</p>;
    if (eligibility.reason === 'NOT_PURCHASED') return <p className="review-note"><Icon name="info" size={15} /> {t('reviews.notEligible')}</p>;
    return null;
  };

  return (
    <section className="pd-section card card-pad product-reviews" id="reviews" ref={sectionRef} aria-labelledby="reviews-title">
      <div className="reviews-head">
        <h2 id="reviews-title">{t('reviews.title')}</h2>
        {actions()}
      </div>
      {note()}

      {status === 'loading' && !summary ? (
        <div className="reviews-skeleton" aria-busy="true">
          <div className="skeleton" style={{ height: 110, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 70, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 70, borderRadius: 14 }} />
        </div>
      ) : status === 'error' ? (
        <EmptyState icon="alert" title={t('reviews.loadFailed')}>
          <button type="button" className="btn btn-sm" onClick={reload}>
            <Icon name="refresh" size={16} /> {t('common.retry')}
          </button>
        </EmptyState>
      ) : summary && summary.count === 0 ? (
        <EmptyState icon="star" title={t('reviews.noReviews')} text={eligibility?.canReview ? t('reviews.beFirst') : t('reviews.noReviewsText')} />
      ) : (
        summary && (
          <div className="reviews-body">
            <ReviewSummary
              summary={summary}
              filter={filter}
              onFilter={(f) => {
                setFilter(f);
              }}
            />
            <div className="reviews-list-wrap">
              <div className="reviews-toolbar">
                <span className="muted" aria-live="polite">
                  {filter ? (
                    <>
                      {t('reviews.filteredBy', { star: filter, count: list.total })}{' '}
                      <button type="button" className="link" onClick={() => setFilter(null)}>
                        {t('reviews.clearFilter')}
                      </button>
                    </>
                  ) : (
                    t('reviews.totalReviews', { count: summary.count })
                  )}
                </span>
                <select className="select input-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('reviews.sortLabel')}>
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`reviews.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <ul className={`review-list ${status === 'loading' ? 'is-loading' : ''}`}>
                {list.reviews.map((r) => (
                  <ReviewItem key={r._id} review={r} own={r._id === ownId} />
                ))}
              </ul>
              {list.page < list.pages && (
                <button type="button" className="btn btn-block reviews-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t('reviews.loading') : t('reviews.loadMore', { count: list.total - list.reviews.length })}
                </button>
              )}
            </div>
          </div>
        )
      )}

      {form && (
        <ReviewForm
          productId={productId}
          productName={productName}
          review={form.review}
          onClose={() => setForm(null)}
          onSaved={afterChange}
        />
      )}
    </section>
  );
};

export default ProductReviews;
