import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { PAYMENT_RETURN_MESSAGE } from '../components/checkout/PaymentModal';

/*
 * ბანკი გადახდის შემდეგ ბრაუზერს აქ აბრუნებს (/payment/return?order=...&result=...).
 * გვერდი ჩვეულებრივ იტვირთება გადახდის მოდალის iframe-ში — ის მხოლოდ ატყობინებს მშობელ
 * ფანჯარას. შედეგს (გადახდილია თუ არა) ყოველთვის სერვერი ამოწმებს ბანკთან; `result`
 * პარამეტრი მხოლოდ ტექსტის საჩვენებლადაა და გადაწყვეტილებას მასზე არ ვიღებთ.
 */
const PaymentReturn = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const result = params.get('result');
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const msg = { type: PAYMENT_RETURN_MESSAGE, orderId, result };
    const origin = window.location.origin;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, origin);
    } else if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, origin);
    } else {
      setStandalone(true);
    }
  }, [orderId, result]);

  const ok = result === 'success';

  return (
    <div className="payment-return">
      <div className="payment-return-box">
        {standalone ? (
          <>
            <span className={`pay-state-icon ${ok ? 'ok' : ''}`}>
              <Icon name={ok ? 'check' : 'info'} size={28} />
            </span>
            <strong>{ok ? t('paymentReturn.processed') : t('paymentReturn.finished')}</strong>
            <span>{t('paymentReturn.text')}</span>
            <Link to="/profile?tab=orders" className="btn">
              {t('nav.myOrders')}
            </Link>
          </>
        ) : (
          <>
            <span className="spinner" />
            <strong>{t('payment.verifying')}</strong>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentReturn;
