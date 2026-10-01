import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import { EmptyState, QuantityStepper, formatPrice } from '../components/ui';

const Cart = () => {
  const { items, updateQuantity, removeFromCart, totalPrice, totalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(null);

  const handleCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  const handleRemove = (productId) => {
    setRemoving(productId);
    setTimeout(() => {
      removeFromCart(productId);
      setRemoving(null);
    }, 250);
  };

  if (items.length === 0) {
    return (
      <div className="container page">
        <EmptyState icon="cart" title="კალათა ცარიელია" text="როგორც ჩანს, ჯერ არაფერი დაგიმატებიათ. დაათვალიერე პროდუქტები და იპოვე შენთვის სასურველი.">
          <Link to="/" className="btn btn-primary btn-lg">
            <Icon name="arrowLeft" size={18} /> მაღაზიაში დაბრუნება
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1 className="page-title">კალათა</h1>
          <p className="page-subtitle">{totalItems} ნივთი თქვენს კალათაში</p>
        </div>
        <Link to="/products" className="btn btn-ghost btn-sm">
          <Icon name="arrowLeft" size={16} /> ყიდვის გაგრძელება
        </Link>
      </div>

      <div className="split">
        <div className="card card-pad">
          <div className="cart-items">
            {items.map((item) => (
              <div className={`cart-row ${removing === item.productId ? 'removing' : ''}`} key={item.productId}>
                <Link to={`/product/${item.slug || item.productId}`} className="cart-row-img">
                  <img src={item.image || 'https://placehold.co/100x100'} alt={item.name} />
                </Link>
                <div className="cart-row-info">
                  <Link to={`/product/${item.slug || item.productId}`} className="cart-row-name">
                    {item.name}
                  </Link>
                  <span className="cart-row-unit">{formatPrice(item.price)} / ცალი</span>
                  <div className="cart-row-controls">
                    <QuantityStepper size="sm" value={item.quantity} onChange={(q) => updateQuantity(item.productId, q)} />
                    <button className="remove-btn" onClick={() => handleRemove(item.productId)}>
                      <Icon name="trash" size={15} /> წაშლა
                    </button>
                  </div>
                </div>
                <span className="cart-row-total">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="card card-pad summary">
          <h2 className="card-title">შეკვეთის შეჯამება</h2>
          <div className="free-ship done">
            <Icon name="truck" size={16} /> უფასო მიწოდება მთელ საქართველოში · 2–6 სამუშაო დღე
          </div>
          <div className="summary-row">
            <span>ნივთები ({totalItems})</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
          <div className="summary-row">
            <span>მიწოდება</span>
            <strong className="free">უფასო</strong>
          </div>
          <div className="summary-total">
            <span>ჯამი</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={handleCheckout}>
            შეკვეთის გაფორმება <Icon name="arrowRight" size={18} />
          </button>
          {!user && <p className="summary-note">გასაგრძელებლად საჭიროა ავტორიზაცია</p>}
        </aside>
      </div>
    </div>
  );
};

export default Cart;
