import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import CategoriesSidebar from '../components/CategoriesSidebar';
import ProductListing, { DEFAULT_SORT, normalizeSort } from '../components/ProductListing';
import Icon from '../components/Icon';

const CategoryPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    setCategory(null);
    api
      .get(`/category-details/${id}`)
      .then(({ data }) => {
        setCategory(data);
        // Auto-redirect if MongoDB ObjectId was used instead of slug
        if (id === data._id && data.slug) {
          navigate(`/category/${data.slug}`, { replace: true });
        }
      })
      .catch(() => {});
  }, [id]);

  const sort = normalizeSort(params.get('sort'));

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, String(value)) : next.delete(key)));
    if (next.get('sort') === DEFAULT_SORT) next.delete('sort');
    setParams(next);
  };
  const setPage = (p) => updateParams({ page: p > 1 ? p : null });
  const setSort = (s) => updateParams({ sort: s, page: null });
  const discounted = params.get('discounted') === '1';
  const setDiscounted = (on) => updateParams({ discounted: on ? '1' : null, page: null });

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link to="/">მთავარი</Link>
        <Icon name="chevronRight" size={14} />
        <Link to="/products">კატალოგი</Link>
        <Icon name="chevronRight" size={14} />
        <span className="current">{category?.name || '...'}</span>
      </nav>

      <div className="catalog">
        <CategoriesSidebar />

        <ProductListing
          category={id}
          discounted={discounted}
          onDiscountedChange={setDiscounted}
          sort={sort}
          onSortChange={setSort}
          page={page}
          onPageChange={setPage}
          header={(total) => (
            <>
              <h1>{category ? category.name : <span className="skeleton" style={{ display: 'inline-block', width: 180, height: 28 }} />}</h1>
              {total !== null && <span className="count">{total} პროდუქტი</span>}
              {category?.description && <p className="catalog-desc">{category.description}</p>}
            </>
          )}
          emptyTitle="კატეგორია ცარიელია"
          emptyText="ამ კატეგორიაში პროდუქტები ჯერ არ არის."
          emptyAction={
            <Link to="/products" className="btn">
              ყველა პროდუქტის ნახვა
            </Link>
          }
        />
      </div>
    </div>
  );
};

export default CategoryPage;
