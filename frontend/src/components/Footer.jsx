import { Link } from 'react-router-dom';
import Icon from './Icon';
import { BRAND } from '../constants';

const Footer = () => (
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
          <p>ტექნიკა და აქსესუარები საუკეთესო ფასად.</p>
        </div>
        <div>
          <h4>მაღაზია</h4>
          <ul>
            <li><Link to="/products">ყველა პროდუქტი</Link></li>
            <li><Link to="/products?discounted=1&sort=discount_desc">ფასდაკლებები</Link></li>
            <li><Link to="/products?new=1">ახალი პროდუქტები</Link></li>
            <li><Link to="/cart">კალათა</Link></li>
          </ul>
        </div>
        <div>
          <h4>ანგარიში</h4>
          <ul>
            <li><Link to="/profile">ჩემი პროფილი</Link></li>
            <li><Link to="/profile?tab=orders">ჩემი შეკვეთები</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {BRAND.name}. ყველა უფლება დაცულია.</span>
      </div>
    </div>
  </footer>
);

export default Footer;
