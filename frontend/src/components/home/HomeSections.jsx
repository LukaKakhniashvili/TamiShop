import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { getViewedIds } from '../../utils/activity';
import { DEAL_MIN_DISCOUNT } from '../../constants';
import ProductRail from './ProductRail';
import Icon from '../Icon';

const SECTION_SIZE = 10;

// ერთჯერადი ჩატვირთვა; null — იტვირთება, [] — ცარიელი ან შეცდომა. enabled=false — ჯერ არ იტვირთება
const useSectionData = (load, deps = [], enabled = true) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setData(null);
    load()
      .then((items) => !cancelled && setData(items))
      .catch(() => !cancelled && setData([]));
    return () => {
      cancelled = true;
    };
  }, [...deps, enabled]);
  return data;
};

export const HotDealsSection = ({ onViewAll }) => {
  const { t } = useTranslation();
  const products = useSectionData(() =>
    api
      .get('/product-list', { params: { minDiscount: DEAL_MIN_DISCOUNT, sort: 'discount_desc', limit: 24 } })
      .then(({ data }) => data.products)
  );

  return (
    <ProductRail
      id="deals"
      variant="deals"
      icon="flame"
      eyebrow={t('sections.deals.eyebrow', { percent: DEAL_MIN_DISCOUNT })}
      title={t('sections.deals.title')}
      subtitle={t('sections.deals.subtitle', { percent: DEAL_MIN_DISCOUNT })}
      products={products}
      cardProps={() => ({ highlight: true })}
      action={{ label: t('sections.viewAll'), onClick: onViewAll }}
      empty={
        <>
          <Icon name="tag" size={22} />
          <div>
            <strong>{t('sections.deals.emptyTitle', { percent: DEAL_MIN_DISCOUNT })}</strong>
            <span>{t('sections.deals.emptyText')}</span>
          </div>
        </>
      }
    />
  );
};

export const BestSellersSection = () => {
  const { t } = useTranslation();
  const products = useSectionData(() =>
    api.get('/product-best-sellers', { params: { limit: SECTION_SIZE } }).then(({ data }) => data)
  );

  return (
    <ProductRail
      id="best-sellers"
      icon="trophy"
      title={t('sections.bestSellers.title')}
      subtitle={t('sections.bestSellers.subtitle')}
      products={products}
      cardProps={(p, i) => ({ rank: i < 3 ? i + 1 : undefined })}
    />
  );
};

// "ახალი" წესი (ბოლო 14 დღე) განსაზღვრულია სერვერზე — იგივე, რაც ბარათის "ახალი" ბეჯისთვის
export const NewArrivalsSection = ({ onViewAll }) => {
  const { t } = useTranslation();
  const products = useSectionData(() =>
    api
      .get('/product-list', { params: { newOnly: true, sort: 'newest', limit: SECTION_SIZE } })
      .then(({ data }) => data.products)
  );

  return (
    <ProductRail
      id="new-arrivals"
      icon="sparkle"
      title={t('sections.newArrivals.title')}
      subtitle={t('sections.newArrivals.subtitle')}
      products={products}
      action={{ label: t('sections.viewAll'), onClick: onViewAll }}
      empty={
        <>
          <Icon name="sparkle" size={22} />
          <div>
            <strong>{t('sections.newArrivals.emptyTitle')}</strong>
            <span>{t('sections.newArrivals.emptyText')}</span>
          </div>
        </>
      }
    />
  );
};

export const RecommendedSection = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { items } = useCart();
  // კალათის ცვლილებაზე სექცია თავიდან არ იტვირთება — ვიყენებთ უახლეს მდგომარეობას ჩატვირთვის მომენტში
  const cartRef = useRef(items);
  cartRef.current = items;
  const [strategy, setStrategy] = useState('popular');

  const products = useSectionData(
    () =>
      api
        .get('/product-recommended', {
          params: {
            limit: SECTION_SIZE,
            viewed: getViewedIds().join(',') || undefined,
            cart: cartRef.current.map((i) => i.productId).join(',') || undefined,
          },
        })
        .then(({ data }) => {
          setStrategy(data.strategy);
          return data.products;
        }),
    [user?._id],
    // ავტორიზაციის შემოწმებამდე არ ვტვირთავთ, რომ შესულ მომხმარებელს ორჯერ არ ჩაეტვირთოს
    !authLoading
  );

  const personalized = strategy === 'personalized';
  return (
    <ProductRail
      id="recommended"
      icon="heart"
      title={personalized ? t('sections.recommended.titlePersonal') : t('sections.recommended.title')}
      subtitle={personalized ? t('sections.recommended.subtitlePersonal') : t('sections.recommended.subtitle')}
      products={products}
    />
  );
};
