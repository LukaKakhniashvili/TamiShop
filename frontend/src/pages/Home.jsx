import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import PromoHero from '../components/PromoHero';
import ShopHub from '../components/home/ShopHub';
import {
  BestSellersSection,
  HotDealsSection,
  NewArrivalsSection,
  RecommendedSection,
} from '../components/home/HomeSections';
import { CATALOG_PARAMS } from './Catalog';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';
import useDocumentMeta from '../hooks/useDocumentMeta';

// მხოლოდ რეალურად მოქმედი უპირატესობები (მიწოდება და გადახდა — backend/constants/checkout.js)
const perks = [
  { icon: 'truck', key: 'freeDelivery' },
  { icon: 'box', key: 'deliveryTime' },
  { icon: 'receipt', key: 'payOnDelivery' },
];

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
};

/*
 * მთავარი გვერდის იერარქია:
 *   1. ბანერი
 *   2. ძირითადი სავაჭრო ნავიგაცია (ShopHub): კატეგორიები, სწრაფი ფილტრები, სრული კატალოგი
 *   3. აღმოჩენა: ცხელი შეთავაზებები → ახალი → ბესტსელერები → რეკომენდებული
 *   4. დასკვნითი CTA კატალოგისკენ + უპირატესობები
 * სრული სია (ძიება, ფილტრები, სორტირება, გვერდები) ცალკე გვერდზეა — /products.
 */
const Home = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  useDocumentMeta(t('meta.homeTitle'), t('meta.homeDescription'));

  // ძველი ბმულები (/?search=...&page=2) — კატალოგზე გადამისამართება, რომ არ გაფუჭდეს
  if (CATALOG_PARAMS.some((key) => params.has(key))) {
    return <Navigate to={`/products?${params.toString()}`} replace />;
  }

  return (
    <div className="container page">
      <PromoHero onCta={() => scrollToId('deals')} />

      <ShopHub />

      <div className="discover-head">
        <span>{t('home.discover')}</span>
      </div>
      <div className="home-sections">
        <HotDealsSection onViewAll={() => navigate('/products?deals=1&sort=discount_desc')} />
        <NewArrivalsSection onViewAll={() => navigate('/products?new=1')} />
        <BestSellersSection />
        <RecommendedSection />
      </div>

      <section className="catalog-cta">
        <div>
          <h2>{t('home.ctaTitle')}</h2>
          <p>{t('home.ctaText')}</p>
        </div>
        <Link to="/products" className="btn btn-lg hero-cta">
          {t('home.ctaButton')} <Icon name="arrowRight" size={18} />
        </Link>
      </section>

      <div className="perks">
        {perks.map((p) => (
          <div key={p.key} className="card perk">
            <span className="perk-icon">
              <Icon name={p.icon} size={20} />
            </span>
            <div>
              <strong>{t(`home.perks.${p.key}.title`)}</strong>
              <span>{t(`home.perks.${p.key}.text`)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
