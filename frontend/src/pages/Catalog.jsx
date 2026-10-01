import { Link, useSearchParams } from 'react-router-dom';
import CategoriesSidebar from '../components/CategoriesSidebar';
import ProductListing, { DEFAULT_SORT, normalizeSort } from '../components/ProductListing';
import { DEAL_MIN_DISCOUNT } from '../constants';
import Icon from '../components/Icon';

// URL პარამეტრები, რომლებსაც კატალოგი იყენებს (მთავარი გვერდი ძველ ბმულებს აქ გადამისამართებს)
export const CATALOG_PARAMS = ['search', 'page', 'sort', 'deals', 'discounted', 'new'];

// სრული კატალოგი: კატეგორიები, ძიება, ფილტრები, სორტირება და გვერდები — ყველაფერი URL-შია
const Catalog = () => {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = normalizeSort(params.get('sort'));
  const deals = params.get('deals') ? DEAL_MIN_DISCOUNT : 0;
  const discounted = params.get('discounted') === '1';
  const newOnly = params.get('new') === '1';

  // URL-ის განახლება; ფილტრის/სორტირების შეცვლისას გვერდი ბრუნდება პირველზე
  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, String(value)) : next.delete(key)));
    if (resetPage) next.delete('page');
    if (next.get('sort') === DEFAULT_SORT) next.delete('sort');
    setParams(next);
  };

  const title = search
    ? 'ძიების შედეგები'
    : deals
      ? 'ცხელი შეთავაზებები'
      : newOnly
        ? 'ახალი პროდუქტები'
        : 'ყველა პროდუქტი';
  const hasFilters = search || deals || discounted || newOnly;

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link to="/">მთავარი</Link>
        <Icon name="chevronRight" size={14} />
        <span className="current">კატალოგი</span>
      </nav>

      <div className="catalog">
        <CategoriesSidebar />

        <ProductListing
          search={search}
          minDiscount={deals}
          discounted={discounted}
          onDiscountedChange={(on) => updateParams({ discounted: on ? '1' : null })}
          newOnly={newOnly}
          sort={sort}
          onSortChange={(s) => updateParams({ sort: s })}
          page={page}
          onPageChange={(p) => updateParams({ page: p > 1 ? p : null }, { resetPage: false })}
          header={() => (
            <>
              {/* საერთო რაოდენობა მომხმარებელს არ ეჩვენება (გვერდებისთვის კვლავ გამოიყენება) */}
              <h1>{title}</h1>
              {search && (
                <button type="button" className="chip" onClick={() => updateParams({ search: null })}>
                  „{search}" <Icon name="x" size={14} />
                </button>
              )}
              {deals > 0 && (
                <button type="button" className="chip chip-accent" onClick={() => updateParams({ deals: null })}>
                  {DEAL_MIN_DISCOUNT}%+ ფასდაკლება <Icon name="x" size={14} />
                </button>
              )}
              {newOnly && (
                <button type="button" className="chip chip-accent" onClick={() => updateParams({ new: null })}>
                  ბოლო 14 დღე <Icon name="x" size={14} />
                </button>
              )}
            </>
          )}
          emptyTitle={search ? 'ვერაფერი მოიძებნა' : 'პროდუქტები ვერ მოიძებნა'}
          emptyText={
            search
              ? `„${search}"-ზე შედეგი არ არის. სცადეთ სხვა საძიებო სიტყვა.`
              : hasFilters
                ? 'არჩეულ ფილტრებს არცერთი პროდუქტი არ შეესაბამება.'
                : undefined
          }
          emptyAction={
            hasFilters && (
              <button
                type="button"
                className="btn"
                onClick={() => updateParams({ search: null, deals: null, discounted: null, new: null })}
              >
                ყველა პროდუქტის ნახვა
              </button>
            )
          }
        />
      </div>
    </div>
  );
};

export default Catalog;
