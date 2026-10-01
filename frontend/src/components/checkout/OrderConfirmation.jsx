import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import LineOptions from '../LineOptions';
import { formatPrice } from '../ui';
import { paymentStatusPill } from '../../constants';
import { useLocalized } from '../../i18n/content';
import { cityLabel } from './CitySelect';

const CARD_BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' };

// შეკვეთის დადასტურების ეკრანი — ყველა მონაცემი სერვერის პასუხიდან (და არა კალათიდან)
const OrderConfirmation = ({ order, banks = [], cities = [] }) => {
  const { t, i18n } = useTranslation();
  const L = useLocalized();
  const payment = order.payment || {};
  const bank = banks.find((b) => b.id === payment.provider);
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
        <h1>{t('confirmation.title')}</h1>
        <p>
          {t('confirmation.thanks', { name: order.customerInfo?.firstName })}{' '}
          {isCod ? t('confirmation.codText') : t('confirmation.paidText')}
        </p>
        <div className="order-number">
          <span>{t('confirmation.orderNumber')}</span>
          <strong>{order.orderNumber || `#${order._id?.slice(-6).toUpperCase()}`}</strong>
        </div>
      </div>

      <div className="confirmation-grid">
        <section className="card card-pad">
          <h2 className="card-title">
            <Icon name="truck" size={18} /> {t('checkout.delivery')}
          </h2>
          <dl className="summary-details">
            <div>
              <dt>{t('confirmation.recipient')}</dt>
              <dd>
                {order.customerInfo?.firstName} {order.customerInfo?.lastName} · {order.customerInfo?.phone}
              </dd>
            </div>
            <div>
              <dt>{t('checkout.city')}</dt>
              <dd>{cityLabel(cities, address.city, i18n.language)}</dd>
            </div>
            <div>
              <dt>{t('checkout.street')}</dt>
              <dd>{address.street}</dd>
            </div>
            <div>
              <dt>{t('checkout.deliveryType')}</dt>
              <dd>
                {t('checkout.standard')} · {order.delivery?.cost > 0 ? formatPrice(order.delivery.cost) : t('common.free')}
              </dd>
            </div>
            <div>
              <dt>{t('checkout.estimatedTime')}</dt>
              <dd>{t('checkout.deliveryEstimate', { min: 2, max: 6 })}</dd>
            </div>
          </dl>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">
            <Icon name="card" size={18} /> {t('checkout.payment')}
          </h2>
          <dl className="summary-details">
            <div>
              <dt>{t('confirmation.method')}</dt>
              <dd>{t(`checkout.paymentMethods.${payment.method}.label`, { defaultValue: payment.method || '—' })}</dd>
            </div>
            {bank && (
              <div>
                <dt>{t('checkout.bank')}</dt>
                <dd>{t(`checkout.banks.${bank.id}`, { defaultValue: bank.name })}</dd>
              </div>
            )}
            {payment.cardLast4 && (
              <div>
                <dt>{t('confirmation.card')}</dt>
                <dd>
                  {CARD_BRANDS[payment.cardBrand] || payment.cardBrand || ''} •••• {payment.cardLast4}
                </dd>
              </div>
            )}
            {payment.transactionId && (
              <div>
                <dt>{t('confirmation.transaction')}</dt>
                <dd>{payment.transactionId}</dd>
              </div>
            )}
            <div>
              <dt>{t('confirmation.status')}</dt>
              <dd>
                <span className={`pill ${paymentStatusPill[payment.status] || 'pill-neutral'}`}>
                  {t(`paymentStatus.${payment.status}`, { defaultValue: payment.status || '—' })}
                </span>
              </dd>
            </div>
          </dl>
          <div className="order-lines" style={{ marginTop: 16 }}>
            {order.items.map((it, idx) => (
              <div key={idx}>
                <span>
                  {L(it, 'name')} <span className="muted">× {it.quantity}</span>
                  <LineOptions options={it.variant?.options} />
                </span>
                <span>{formatPrice(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="summary-total">
            <span>{isCod ? t('confirmation.payOnDelivery') : t('confirmation.paid')}</span>
            <strong>{formatPrice(order.totalPrice)}</strong>
          </div>
        </section>
      </div>

      <div className="confirmation-actions">
        <Link to="/profile?tab=orders" className="btn btn-lg">
          <Icon name="receipt" size={18} /> {t('nav.myOrders')}
        </Link>
        <Link to="/products" className="btn btn-primary btn-lg">
          {t('cart.continueShopping')} <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </div>
  );
};

export default OrderConfirmation;
