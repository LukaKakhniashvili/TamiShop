import { useEffect, useRef, useState } from 'react';
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
      eyebrow={`${DEAL_MIN_DISCOUNT}%+ ფასდაკლება`}
      title="ცხელი შეთავაზებები"
      subtitle="საუკეთესო ფასები — ყველა პროდუქტი მინიმუმ 40%-იანი ფასდაკლებით"
      products={products}
      cardProps={() => ({ highlight: true })}
      action={{ label: 'ყველას ნახვა', onClick: onViewAll }}
      empty={
        <>
          <Icon name="tag" size={22} />
          <div>
            <strong>ამ ეტაპზე 40%+ ფასდაკლებები არ არის</strong>
            <span>ახალი შეთავაზებები მალე დაემატება — თვალი ადევნეთ!</span>
          </div>
        </>
      }
    />
  );
};

export const BestSellersSection = () => {
  const products = useSectionData(() =>
    api.get('/product-best-sellers', { params: { limit: SECTION_SIZE } }).then(({ data }) => data)
  );

  return (
    <ProductRail
      id="best-sellers"
      icon="trophy"
      title="ბესტსელერები"
      subtitle="ყველაზე გაყიდვადი და პოპულარული პროდუქტები"
      products={products}
      cardProps={(p, i) => ({ rank: i < 3 ? i + 1 : undefined })}
    />
  );
};

// "ახალი" წესი (ბოლო 14 დღე) განსაზღვრულია სერვერზე — იგივე, რაც ბარათის "ახალი" ბეჯისთვის
export const NewArrivalsSection = ({ onViewAll }) => {
  const products = useSectionData(() =>
    api
      .get('/product-list', { params: { newOnly: true, sort: 'newest', limit: SECTION_SIZE } })
      .then(({ data }) => data.products)
  );

  return (
    <ProductRail
      id="new-arrivals"
      icon="sparkle"
      title="ახალი პროდუქტები"
      subtitle="ბოლო 14 დღეში დამატებული პროდუქტები"
      products={products}
      action={{ label: 'ყველას ნახვა', onClick: onViewAll }}
      empty={
        <>
          <Icon name="sparkle" size={22} />
          <div>
            <strong>ბოლო 14 დღეში ახალი პროდუქტი არ დამატებულა</strong>
            <span>ახალი პროდუქტები აქ ავტომატურად გამოჩნდება</span>
          </div>
        </>
      }
    />
  );
};

export const RecommendedSection = () => {
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

  return (
    <ProductRail
      id="recommended"
      icon="heart"
      title={strategy === 'personalized' ? 'რეკომენდებული თქვენთვის' : 'რეკომენდებული პროდუქტები'}
      subtitle={
        strategy === 'personalized'
          ? 'შერჩეულია თქვენი დათვალიერებების, კალათისა და შენაძენების მიხედვით'
          : 'პოპულარული და მაღალი შეფასების მქონე პროდუქტები'
      }
      products={products}
    />
  );
};
