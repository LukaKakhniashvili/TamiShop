import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import ProductCard from './ProductCard';
import Icon from './Icon';
import { EmptyState, Pagination, ProductGridSkeleton } from './ui';

const PAGE_SIZE = 12;

// წარწერები — თარგმანებში: catalog.sort.<value>
export const SORT_OPTIONS = ['newest', 'name_asc', 'name_desc', 'price_asc', 'price_desc', 'discount_desc'].map((value) => ({ value }));
export const DEFAULT_SORT = 'newest';
export const normalizeSort = (value) => (SORT_OPTIONS.some((o) => o.value === value) ? value : DEFAULT_SORT);

const SortSelect = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <label className="sort-control">
      <Icon name="sort" size={16} />
      <span className="sr-only">{t('catalog.sortLabel')}</span>
      <select className="select input-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('catalog.sortLabel')}>
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {t(`catalog.sort.${o.value}`)}
          </option>
        ))}
      </select>
    </label>
  );
};

/**
 * პროდუქტების სია ფილტრებით, სორტირებითა და გვერდებით.
 * header(total) აბრუნებს სათაურის მარცხენა ნაწილს; სორტირების კონტროლი ემატება მარჯვნივ.
 */
const ProductListing = ({
  category,
  search,
  minDiscount,
  discounted = false,
  onDiscountedChange,
  newOnly = false,
  sort = DEFAULT_SORT,
  onSortChange,
  page,
  onPageChange,
  header,
  emptyTitle,
  emptyText,
  emptyAction,
}) => {
  const { t, i18n } = useTranslation();
  // სახელით სორტირება სერვერზე არჩეული ენით ხდება — ენის შეცვლისას სია თავიდან იტვირთება
  const sortLanguage = sort.startsWith('name') ? i18n.language : null;
  const [data, setData] = useState({ products: [], pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const topRef = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .get('/product-list', {
        params: {
          page,
          limit: PAGE_SIZE,
          sort,
          search: search || undefined,
          category: category || undefined,
          minDiscount: minDiscount || undefined,
          discounted: discounted || undefined,
          newOnly: newOnly || undefined,
        },
      })
      .then(({ data: res }) => {
        if (!cancelled) setData({ products: res.products, pages: res.pages, total: res.total });
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, search, minDiscount, discounted, newOnly, sort, page, sortLanguage]);

  // გვერდის შეცვლისას სია ჩანდეს, მაგრამ არა პირველ ჩატვირთვაზე
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    }
  }, [page]);

  return (
    <div ref={topRef} id="products" className="listing">
      <div className="catalog-head">
        <div className="catalog-head-main">{header(loading ? null : data.total)}</div>
        <div className="listing-tools">
          {onDiscountedChange && (
            <label className="switch discount-toggle">
              <input type="checkbox" checked={discounted} onChange={(e) => onDiscountedChange(e.target.checked)} />
              <span className="track" />
              {t('catalog.discountedOnly')}
            </label>
          )}
          {onSortChange && <SortSelect value={sort} onChange={onSortChange} />}
        </div>
      </div>

      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : error ? (
        <EmptyState icon="alert" title={t('catalog.loadErrorTitle')} text={t('catalog.loadErrorText')} />
      ) : data.products.length === 0 ? (
        <EmptyState icon="search" title={emptyTitle} text={emptyText}>
          {emptyAction}
        </EmptyState>
      ) : (
        <>
          <div className="product-grid" key={`${category}-${search}-${minDiscount}-${discounted}-${newOnly}-${sort}-${page}`}>
            {data.products.map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} />
            ))}
          </div>
          <Pagination page={page} totalPages={data.pages} onChange={onPageChange} />
        </>
      )}
    </div>
  );
};

export default ProductListing;
