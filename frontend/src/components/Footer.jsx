import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { BRAND } from '../constants';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand">
              <span className="brand-mark">
                <Icon name="cart" size={18} strokeWidth={2.5} />
              </span>
              <span className="brand-name">
                {BRAND.main} <b>{BRAND.accent}</b>
              </span>
            </Link>
            <p>{t('footer.tagline')}</p>
          </div>
          <div>
            <h4>{t('footer.shop')}</h4>
            <ul>
              <li><Link to="/products">{t('footer.allProducts')}</Link></li>
              <li><Link to="/products?discounted=1&sort=discount_desc">{t('footer.discounts')}</Link></li>
              <li><Link to="/products?new=1">{t('footer.newProducts')}</Link></li>
              <li><Link to="/cart">{t('nav.cart')}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t('footer.account')}</h4>
            <ul>
              <li><Link to="/profile">{t('nav.myProfile')}</Link></li>
              <li><Link to="/profile?tab=orders">{t('nav.myOrders')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t('footer.rights', { year: new Date().getFullYear(), brand: BRAND.name })}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
