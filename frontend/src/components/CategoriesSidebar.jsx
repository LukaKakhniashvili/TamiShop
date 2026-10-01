import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../api/axios';
import Icon from './Icon';

const iconRules = [
  [['მობილურ', 'ტელეფონ', 'phone'], 'smartphone'],
  [['ტაბ', 'პლანშეტ', 'tablet'], 'tablet'],
  [['საათ', 'watch'], 'watch'],
  [['ლეპტოპ', 'კომპიუტერ', 'laptop', 'it'], 'laptop'],
  [['აუდიო', 'ყურსასმ', 'audio', 'ხმა'], 'headphones'],
  [['გეიმ', 'gaming', 'თამაშ'], 'gamepad'],
  [['tv', 'ტელევიზ', 'მონიტორ', 'ეკრან'], 'monitor'],
  [['ფოტო', 'ვიდეო', 'კამერა', 'camera'], 'camera'],
  [['ელექტრონ'], 'smartphone'],
  [['ფეხსაცმ'], 'sneaker'],
  [['სამოს', 'ტანსაცმ'], 'shirt'],
  [['სამზარეულ'], 'utensils'],
  [['სახლ', 'ბაღ', 'ავეჯ'], 'home'],
  [['სილამაზ', 'კოსმეტ', 'სუნამო'], 'sparkle'],
  [['სპორტ'], 'dumbbell'],
];

export const getCategoryIcon = (name) => {
  const n = name.toLowerCase();
  const match = iconRules.find(([keys]) => keys.some((k) => n.includes(k)));
  return match ? match[1] : 'tag';
};

// Categories rarely change, so share one request across page navigations
let cache = null;

const CategoriesSidebar = () => {
  const [categories, setCategories] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    api
      .get('/category-list')
      .then(({ data }) => {
        cache = data;
        setCategories(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const itemClass = ({ isActive }) => `cat-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="cat-nav">
      <div className="cat-nav-title">კატეგორიები</div>
      <nav className="cat-list">
        <NavLink to="/products" end className={itemClass}>
          <span className="cat-icon">
            <Icon name="grid" size={17} />
          </span>
          <span>ყველა</span>
        </NavLink>

        {loading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" />)
          : categories.map((cat) => (
              <NavLink key={cat._id} to={`/category/${cat.slug || cat._id}`} className={itemClass}>
                <span className="cat-icon">
                  <Icon name={getCategoryIcon(cat.name)} size={17} />
                </span>
                <span>{cat.name}</span>
              </NavLink>
            ))}
      </nav>
    </aside>
  );
};

export default CategoriesSidebar;
