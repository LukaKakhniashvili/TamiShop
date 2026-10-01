import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLocalized } from '../i18n/content';
import useDocumentMeta from '../hooks/useDocumentMeta';
import Icon from '../components/Icon';
import LineOptions from '../components/LineOptions';
import { EmptyState, QuantityStepper, formatPrice } from '../components/ui';

const Cart = () => {
  const { t } = useTranslation();
  const L = useLocalized();
  const { items, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(null);
  useDocumentMeta(t('cart.title'));

  const handleCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  const handleRemove = (lineId) => {
    setRemoving(lineId);
    setTimeout(() => {
      removeFromCart(lineId);
      setRemoving(null);
    }, 250);
  };

  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon="cart" title={t('cart.emptyTitle')} text={t('cart.emptyText')}>
          <Link to="/" className="btn btn-primary btn-lg">
            <Icon name="arrowLeft" size={18} /> {t('common.backToShop')}
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('cart.title')}</h1>
          <p className="page-subtitle">{t('cart.itemsInCart', { count: totalItems })}</p>
        </div>
        <Link to="/products" className="btn btn-ghost btn-sm">
          <Icon name="arrowLeft" size={16} /> {t('cart.continueShopping')}
        </Link>
      </div>

      <div className="split">
        <div className="card card-pad">
          <div className="cart-items">
            {items.map((item) => {
              const name = L(item, 'name');
              return (
                <div className={`cart-row ${removing === item.lineId ? 'removing' : ''}`} key={item.lineId}>
                  <Link to={`/product/${item.slug || item.productId}`} className="cart-row-img">
                    <img src={item.image || 'https://placehold.co/100x100'} alt={name} />
                  </Link>
                  <div className="cart-row-info">
                    <Link to={`/product/${item.slug || item.productId}`} className="cart-row-name">
                      {name}
                    </Link>
                    <LineOptions options={item.options} />
                    <span className="cart-row-unit">{t('cart.perUnit', { price: formatPrice(item.price) })}</span>
                    <div className="cart-row-controls">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={item.maxQuantity || 99}
                        onChange={(q) => updateQuantity(item.lineId, q)}
                      />
                      <button className="remove-btn" onClick={() => handleRemove(item.lineId)}>
                        <Icon name="trash" size={15} /> {t('cart.remove')}
                      </button>
                    </div>
                  </div>
                  <span className="cart-row-total">{formatPrice(item.price * item.quantity)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="card card-pad summary">
          <h2 className="card-title">{t('cart.summary')}</h2>
          <div className="free-ship done">
            <Icon name="truck" size={16} /> {t('cart.freeShipping')}
          </div>
          <div className="summary-row">
            <span>{t('cart.items', { count: totalItems })}</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
          <div className="summary-row">
            <span>{t('cart.delivery')}</span>
            <strong className="free">{t('common.free')}</strong>
          </div>
          <div className="summary-total">
            <span>{t('cart.total')}</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={handleCheckout}>
            {t('cart.checkout')} <Icon name="arrowRight" size={18} />
          </button>
          {!user && <p className="summary-note">{t('cart.loginRequired')}</p>}
        </aside>
      </div>
    </div>
  );
};

export default Cart;
