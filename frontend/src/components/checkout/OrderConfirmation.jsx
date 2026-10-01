import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { formatPrice } from '../ui';
import { paymentStatusLabels, paymentStatusPill } from '../../constants';

const CARD_BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' };

// შეკვეთის დადასტურების ეკრანი — ყველა მონაცემი სერვერის პასუხიდან (და არა კალათიდან)
const OrderConfirmation = ({ order, paymentMethods, banks = [] }) => {
  const payment = order.payment || {};
  const methodLabel = paymentMethods.find((m) => m.id === payment.method)?.label || payment.method;
  const bankName = banks.find((b) => b.id === payment.provider)?.name;
  const isCod = payment.method === 'cod';
  const address = order.customerInfo?.address || {};

  return (
    <div className="confirmation">
      <div className="confirmation-hero">
        <div className="success-check">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1>შეკვეთა მიღებულია!</h1>
        <p>
          გმადლობთ, {order.customerInfo?.firstName}!{' '}
          {isCod
            ? 'შეკვეთა გაფორმდა — გადაიხდით კურიერთან მიღებისას.'
            : 'გადახდა წარმატებით შესრულდა და შეკვეთა გაფორმდა.'}
        </p>
        <div className="order-number">
          <span>შეკვეთის ნომერი</span>
          <strong>{order.orderNumber || `#${order._id?.slice(-6).toUpperCase()}`}</strong>
        </div>
      </div>

      <div className="confirmation-grid">
        <section className="card card-pad">
          <h2 className="card-title">
            <Icon name="truck" size={18} /> მიწოდება
          </h2>
          <dl className="summary-details">
            <div>
              <dt>მიმღები</dt>
              <dd>
                {order.customerInfo?.firstName} {order.customerInfo?.lastName} · {order.customerInfo?.phone}
              </dd>
            </div>
            <div>
              <dt>ქალაქი</dt>
              <dd>{address.city}</dd>
            </div>
            <div>
              <dt>მისამართი</dt>
              <dd>{address.street}</dd>
            </div>
            <div>
              <dt>მიწოდების ტიპი</dt>
              <dd>სტანდარტული · {order.delivery?.cost > 0 ? formatPrice(order.delivery.cost) : 'უფასო'}</dd>
            </div>
            <div>
              <dt>სავარაუდო ვადა</dt>
              <dd>{order.delivery?.estimate}</dd>
            </div>
          </dl>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">
            <Icon name="card" size={18} /> გადახდა
          </h2>
          <dl className="summary-details">
            <div>
              <dt>მეთოდი</dt>
              <dd>{methodLabel}</dd>
            </div>
            {bankName && (
              <div>
                <dt>ბანკი</dt>
                <dd>{bankName}</dd>
              </div>
            )}
            {payment.cardLast4 && (
              <div>
                <dt>ბარათი</dt>
                <dd>
                  {CARD_BRANDS[payment.cardBrand] || payment.cardBrand || ''} •••• {payment.cardLast4}
                </dd>
              </div>
            )}
            {payment.transactionId && (
              <div>
                <dt>ტრანზაქცია</dt>
                <dd>{payment.transactionId}</dd>
              </div>
            )}
            <div>
              <dt>სტატუსი</dt>
              <dd>
                <span className={`pill ${paymentStatusPill[payment.status] || 'pill-neutral'}`}>
                  {paymentStatusLabels[payment.status] || payment.status}
                </span>
              </dd>
            </div>
          </dl>
          <div className="order-lines" style={{ marginTop: 16 }}>
            {order.items.map((it, idx) => (
              <div key={idx}>
                <span>
                  {it.name} <span className="muted">× {it.quantity}</span>
                </span>
                <span>{formatPrice(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <span>{isCod ? 'გადასახდელი კურიერთან' : 'გადახდილია'}</span>
            <strong>{formatPrice(order.totalPrice)}</strong>
          </div>
        </section>
      </div>

      <div className="confirmation-actions">
        <Link to="/profile?tab=orders" className="btn btn-lg">
          <Icon name="receipt" size={18} /> ჩემი შეკვეთები
        </Link>
        <Link to="/products" className="btn btn-primary btn-lg">
          ყიდვის გაგრძელება <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </div>
  );
};

export default OrderConfirmation;
