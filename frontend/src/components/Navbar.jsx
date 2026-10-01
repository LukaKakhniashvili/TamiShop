import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Icon from './Icon';
import { getInitials } from './ui';
import { BRAND } from '../constants';

const useTheme = () => {
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#192a37' : '#f6f5f2');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
};

const SearchBox = ({ className = '' }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const [value, setValue] = useState(params.get('search') || '');

  // Keep the box in sync with the URL (e.g. when the search is cleared on the page)
  useEffect(() => {
    setValue(location.pathname === '/products' ? params.get('search') || '' : '');
  }, [params, location.pathname]);

  // ძიება ყოველთვის სრულ კატალოგში ხდება
  const submit = (e) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : '/products');
  };

  return (
    <form className={`nav-search ${className}`} onSubmit={submit} role="search">
      <div className="input-group has-action">
        <span className="input-icon">
          <Icon name="search" size={18} />
        </span>
        <input
          className="input"
          type="search"
          placeholder="მოძებნე პროდუქტი..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="ძებნა"
        />
        {value && (
          <button
            type="button"
            className="input-action"
            aria-label="გასუფთავება"
            onClick={() => {
              setValue('');
              if (params.get('search')) navigate('/products');
            }}
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
    </form>
  );
};

const UserMenu = ({ user, logout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  const isStaff = user.role === 'admin' || user.role === 'manager';

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar">{getInitials(user)}</span>
        <span className="name">{user.firstName || user.email}</span>
        <Icon name="chevronDown" size={16} className="chev" />
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown-head">
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <span>{user.email}</span>
          </div>
          <Link to="/profile" className="dropdown-item" role="menuitem">
            <Icon name="user" size={18} /> ჩემი პროფილი
          </Link>
          <Link to="/profile?tab=orders" className="dropdown-item" role="menuitem">
            <Icon name="receipt" size={18} /> ჩემი შეკვეთები
          </Link>
          {isStaff && (
            <Link to="/admin" className="dropdown-item" role="menuitem">
              <Icon name="dashboard" size={18} /> სამართავი პანელი
            </Link>
          )}
          <button className="dropdown-item danger" role="menuitem" onClick={logout}>
            <Icon name="logout" size={18} /> გასვლა
          </button>
        </div>
      )}
    </div>
  );
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [theme, toggleTheme] = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const isStaff = user && (user.role === 'admin' || user.role === 'manager');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItem = ({ isActive }) => `bn-item ${isActive ? 'active' : ''}`;

  return (
    <>
      <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container">
          <div className="nav-inner">
            <Link to="/" className="brand" aria-label="მთავარი გვერდი">
              <span className="brand-mark">
                <Icon name="cart" size={18} strokeWidth={2.5} />
              </span>
              <span className="brand-name">
                {BRAND.main} <b>{BRAND.accent}</b>
              </span>
            </Link>

            <NavLink to="/products" className={({ isActive }) => `nav-catalog nav-desktop-only ${isActive ? 'active' : ''}`}>
              <Icon name="grid" size={18} />
              კატალოგი
            </NavLink>

            <SearchBox className="desktop" />

            <div className="nav-actions">
              <button
                onClick={toggleTheme}
                className="icon-btn theme-toggle"
                aria-label={theme === 'light' ? 'მუქი თემა' : 'ღია თემა'}
                title={theme === 'light' ? 'მუქი თემა' : 'ღია თემა'}
              >
                <span className="icon-anim" key={theme}>
                  <Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} />
                </span>
              </button>

              <Link to="/cart" className="icon-btn cart-btn nav-desktop-only" aria-label={`კალათა (${totalItems})`}>
                <Icon name="cart" size={21} />
                {totalItems > 0 && (
                  <span className="count" key={totalItems}>
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Link>

              <div className="nav-desktop-only">
                {user ? (
                  <UserMenu user={user} logout={logout} />
                ) : (
                  <Link to="/login" className="btn btn-dark btn-sm" style={{ marginLeft: 8 }}>
                    <Icon name="login" size={16} /> შესვლა
                  </Link>
                )}
              </div>
            </div>
          </div>
          <SearchBox className="nav-mobile-search" />
        </div>
      </header>

      <nav className="bottom-nav" aria-label="მობილური ნავიგაცია">
        <NavLink to="/" end className={navItem}>
          <Icon name="home" size={22} />
          <span>მთავარი</span>
        </NavLink>
        <NavLink to="/products" className={navItem}>
          <Icon name="grid" size={22} />
          <span>კატალოგი</span>
        </NavLink>
        <NavLink to="/cart" className={navItem}>
          <Icon name="cart" size={22} />
          {totalItems > 0 && (
            <span className="count" key={totalItems}>
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
          <span>კალათა</span>
        </NavLink>
        {isStaff && (
          <NavLink to="/admin" className={navItem}>
            <Icon name="dashboard" size={22} />
            <span>პანელი</span>
          </NavLink>
        )}
        <NavLink to={user ? '/profile' : '/login'} className={navItem}>
          <Icon name="user" size={22} />
          <span>{user ? 'პროფილი' : 'შესვლა'}</span>
        </NavLink>
      </nav>
    </>
  );
};

export default Navbar;
