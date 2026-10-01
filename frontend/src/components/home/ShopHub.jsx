import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Icon from '../Icon';
import { getCategoryIcon } from '../CategoriesSidebar';
import { DEAL_MIN_DISCOUNT } from '../../constants';

// სწრაფი წვდომა კატალოგზე — იგივე URL პარამეტრები, რასაც კატალოგის გვერდი იყენებს.
// count — API-დან, იმავე ფილტრით (null = არ ვაჩვენებთ რიცხვს)
const QUICK_LINKS = [
  { key: 'discounted', icon: 'tag', label: 'ფასდაკლებული', to: '/products?discounted=1&sort=discount_desc', count: { discounted: true } },
  { key: 'deals', icon: 'flame', label: `${DEAL_MIN_DISCOUNT}%+ ფასდაკლება`, to: '/products?deals=1&sort=discount_desc', count: { minDiscount: DEAL_MIN_DISCOUNT } },
  { key: 'new', icon: 'sparkle', label: 'ახალი პროდუქტები', to: '/products?new=1', count: { newOnly: true } },
  { key: 'cheap', icon: 'sort', label: 'იაფიდან ძვირისკენ', to: '/products?sort=price_asc', count: null },
];

const countQuery = (filter) =>
  api.get('/product-list', { params: { ...filter, limit: 1 } }).then(({ data }) => data.total).catch(() => null);

const useHubData = () => {
  const [categories, setCategories] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    api
      .get('/category-list', { params: { withStats: true } })
      .then(({ data }) => !cancelled && setCategories(data.filter((c) => c.productCount > 0)))
      .catch(() => !cancelled && setCategories([]));

    Promise.all([
      ...QUICK_LINKS.filter((q) => q.count).map((q) => countQuery(q.count).then((n) => [q.key, n])),
    ]).then((entries) => !cancelled && setCounts(Object.fromEntries(entries)));

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, counts };
};

const CategoryTile = ({ category, index }) => (
  <Link to={`/category/${category.slug || category._id}`} className="cat-tile reveal" style={{ '--i': index }}>
    <span className="cat-tile-icon">
      <Icon name={getCategoryIcon(category.name)} size={18} />
    </span>
    <span className="cat-tile-text">
      <strong>{category.name}</strong>
      <small>{category.productCount} პროდუქტი</small>
    </span>
    {category.previewImage && <img src={category.previewImage} alt="" loading="lazy" className="cat-tile-img" />}
  </Link>
);

/**
 * მთავარი გვერდის ძირითადი სავაჭრო ნავიგაცია: კატეგორიები + სწრაფი ფილტრები + სრული კატალოგი.
 * ვიზუალურად გამოყოფილია აღმოჩენის/სარეკლამო სექციებისგან (HomeSections).
 */
const ShopHub = () => {
  const { categories, counts } = useHubData();

  return (
    <section className="shop-hub" aria-labelledby="shop-hub-title">
      <div className="shop-hub-head">
        <div>
          <h2 id="shop-hub-title">იყიდე კატეგორიების მიხედვით</h2>
          <p>აირჩიე კატეგორია ან დაათვალიერე სრული კატალოგი</p>
        </div>
        <Link to="/products" className="btn btn-primary shop-hub-cta">
          <Icon name="grid" size={18} />
          ყველა პროდუქტი
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>

      <div className="cat-tiles">
        {categories
          ? categories.map((c, i) => <CategoryTile key={c._id} category={c} index={i} />)
          : Array.from({ length: 8 }).map((_, i) => <div key={i} className="cat-tile skeleton" />)}
      </div>

      <div className="quick-links" aria-label="სწრაფი ფილტრები">
        <span className="quick-links-label">სწრაფი ფილტრები:</span>
        {QUICK_LINKS.map((q) => (
          <Link key={q.key} to={q.to} className="quick-link">
            <Icon name={q.icon} size={15} />
            {q.label}
            {counts[q.key] != null && <span className="quick-link-count">{counts[q.key]}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default ShopHub;
