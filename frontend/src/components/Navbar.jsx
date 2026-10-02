import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/UIContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import { useWishlist } from '../context/WishlistContext';
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
  const { t } = useTranslation();
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
          placeholder={t('nav.searchPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('nav.search')}
        />
        {value && (
          <button
            type="button"
            className="input-action"
            aria-label={t('common.clear')}
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

// ანგარიშის მენიუ — დესკტოპზე სახელით, მობილურზე კომპაქტური ავატარით (CSS); ორივეგან ერთი და იგივე გასვლის ლოგიკა
const UserMenu = ({ user, onLogout, theme, onToggleTheme }) => {
  const { t } = useTranslation();
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
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('nav.accountMenu')}
        onClick={() => setOpen((o) => !o)}
      >
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
            <Icon name="user" size={18} /> {t('nav.myProfile')}
          </Link>
          <Link to="/profile?tab=orders" className="dropdown-item" role="menuitem">
            <Icon name="receipt" size={18} /> {t('nav.myOrders')}
          </Link>
          <Link to="/profile?tab=wishlist" className="dropdown-item" role="menuitem">
            <Icon name="heart" size={18} /> {t('wishlist.title')}
          </Link>
          <Link to="/notifications" className="dropdown-item" role="menuitem">
            <Icon name="bell" size={18} /> {t('notifications.title')}
          </Link>
          <button type="button" className="dropdown-item theme-item" role="menuitem" onClick={onToggleTheme}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} /> {theme === 'light' ? t('nav.darkTheme') : t('nav.lightTheme')}
          </button>
          {isStaff && (
            <Link to="/admin" className="dropdown-item" role="menuitem">
              <Icon name="dashboard" size={18} /> {t('nav.adminPanel')}
            </Link>
          )}
          <button
            className="dropdown-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <Icon name="logout" size={18} /> {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
};

const Navbar = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const { count: wishlistCount } = useWishlist();
  const toast = useToast();
  const navigate = useNavigate();

  // გასვლა — ერთი ჰენდლერი დესკტოპისა და მობილურისთვის: სესიის გასუფთავება (AuthContext.logout),
  // შეტყობინება და მთავარ გვერდზე გადასვლა (დაცული გვერდი აღარ რჩება გახსნილი)
  const handleLogout = () => {
    logout();
    toast({ title: t('nav.loggedOut') });
    navigate('/', { replace: true });
  };
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
            <Link to="/" className="brand" aria-label={t('nav.homePage')}>
              <span className="brand-mark">
                <Icon name="cart" size={18} strokeWidth={2.5} />
              </span>
              <span className="brand-name">
                {BRAND.main} <b>{BRAND.accent}</b>
              </span>
            </Link>

            <NavLink to="/products" className={({ isActive }) => `nav-catalog nav-desktop-only ${isActive ? 'active' : ''}`}>
              <Icon name="grid" size={18} />
              {t('nav.catalog')}
            </NavLink>

            <SearchBox className="desktop" />

            <div className={`nav-actions ${user ? 'has-user' : ''}`}>
              <LanguageSwitcher />
              <button
                onClick={toggleTheme}
                className="icon-btn theme-toggle"
                aria-label={theme === 'light' ? t('nav.darkTheme') : t('nav.lightTheme')}
                title={theme === 'light' ? t('nav.darkTheme') : t('nav.lightTheme')}
              >
                <span className="icon-anim" key={theme}>
                  <Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} />
                </span>
              </button>

              {user && (
                <Link to="/profile?tab=wishlist" className="icon-btn cart-btn wish-link nav-desktop-only" aria-label={t('wishlist.headerLabel', { count: wishlistCount })} title={t('wishlist.title')}>
                  <Icon name="heart" size={20} />
                  {wishlistCount > 0 && (
                    <span className="count" key={wishlistCount}>
                      {wishlistCount > 99 ? '99+' : wishlistCount}
                    </span>
                  )}
                </Link>
              )}

              <Link to="/cart" className="icon-btn cart-btn nav-desktop-only" aria-label={t('nav.cartWithCount', { count: totalItems })}>
                <Icon name="cart" size={21} />
                {totalItems > 0 && (
                  <span className="count" key={totalItems}>
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </Link>

              {user && <NotificationBell />}

              {user ? (
                // მობილურზეც ჩანს (კომპაქტური ავატარი) — იქ ერთადერთი გზაა გასვლისთვის
                <UserMenu user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
              ) : (
                <div className="nav-desktop-only">
                  <Link to="/login" className="btn btn-dark btn-sm" style={{ marginLeft: 8 }}>
                    <Icon name="login" size={16} /> {t('nav.login')}
                  </Link>
                </div>
              )}
            </div>
          </div>
          <SearchBox className="nav-mobile-search" />
        </div>
      </header>

      <nav className="bottom-nav" aria-label={t('nav.mobileNav')}>
        <NavLink to="/" end className={navItem}>
          <Icon name="home" size={22} />
          <span>{t('nav.home')}</span>
        </NavLink>
        <NavLink to="/products" className={navItem}>
          <Icon name="grid" size={22} />
          <span>{t('nav.catalog')}</span>
        </NavLink>
        <NavLink to="/cart" className={navItem}>
          <Icon name="cart" size={22} />
          {totalItems > 0 && (
            <span className="count" key={totalItems}>
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
          <span>{t('nav.cart')}</span>
        </NavLink>
        {isStaff && (
          <NavLink to="/admin" className={navItem}>
            <Icon name="dashboard" size={22} />
            <span>{t('nav.panel')}</span>
          </NavLink>
        )}
        <NavLink to={user ? '/profile' : '/login'} className={navItem}>
          <Icon name="user" size={22} />
          <span>{user ? t('nav.profile') : t('nav.login')}</span>
        </NavLink>
      </nav>
    </>
  );
};

export default Navbar;
