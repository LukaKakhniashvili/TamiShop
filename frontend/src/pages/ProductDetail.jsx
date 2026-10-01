import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { trackProductView } from '../utils/activity';
import Icon from '../components/Icon';
import VariantSelector from '../components/VariantSelector';
import { useTranslation } from 'react-i18next';
import { localizedSpecs, useLocalized } from '../i18n/content';
import useDocumentMeta from '../hooks/useDocumentMeta';
import { Alert, EmptyState, Price, QuantityStepper, formatPrice, productDiscount } from '../components/ui';
import {
  describeVariant,
  firstMissingOption,
  hasVariants,
  initialSelection,
  isAvailable,
  priceRange,
  resolveVariant,
  selectValue,
} from '../utils/variants';

const PLACEHOLDER = 'https://placehold.co/600x600?text=No+Image';

// meta description: HTML აღწერიდან სუფთა ტექსტი (≤160 სიმბოლო)
const metaDescription = (html) => {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? (text.length > 160 ? `${text.slice(0, 157)}…` : text) : undefined;
};

const DetailSkeleton = () => (
  <div className="pd">
    <div className="skeleton" style={{ aspectRatio: '1 / 1', borderRadius: 26 }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="skeleton" style={{ height: 14, width: '30%' }} />
      <div className="skeleton" style={{ height: 36, width: '85%' }} />
      <div className="skeleton" style={{ height: 36, width: '40%' }} />
      <div className="skeleton" style={{ height: 52, width: '100%', marginTop: 12 }} />
    </div>
  </div>
);

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const [selection, setSelection] = useState({}); // { optionId: valueId }
  const [missingOptionId, setMissingOptionId] = useState(null);
  const { addToCart } = useCart();
  const { t, i18n } = useTranslation();
  const L = useLocalized();
  useDocumentMeta(product ? L(product, 'name') : notFound ? t('product.notFoundTitle') : '', product ? metaDescription(L(product, 'description')) : undefined);

  useEffect(() => {
    setProduct(null);
    setNotFound(false);
    setCurrentIndex(0);
    setQuantity(1);
    setMissingOptionId(null);
    api
      .get(`/product-details/${id}`)
      .then(({ data }) => {
        setProduct(data);
        setSelection(initialSelection(data));
        trackProductView(data._id);
        // Auto-redirect if MongoDB ObjectId was used instead of slug
        if (id === data._id && data.slug) {
          navigate(`/product/${data.slug}`, { replace: true });
        }
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const images = product?.images?.length ? product.images : [product?.image || PLACEHOLDER];

  useEffect(() => {
    if (!product || images.length < 2) return;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowLeft') setCurrentIndex((p) => (p - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setCurrentIndex((p) => (p + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, images.length]);

  if (notFound) {
    return (
      <div className="container page">
        <EmptyState icon="box" title={t('product.notFoundTitle')} text={t('product.notFoundText')}>
          <Link to="/" className="btn btn-primary">
            {t('common.backToShop')}
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 14, width: 200, marginBottom: 20 }} />
        <DetailSkeleton />
      </div>
    );
  }

  // ---- თარგმნილი დინამიკური კონტენტი (არჩეული ენა → ქართული)
  const name = L(product, 'name');
  const description = L(product, 'description');
  const categoryName = product.category ? L(product.category, 'name') : '';
  const specs = localizedSpecs(product, i18n.language);

  // ---- ვარიანტები: არჩევანი → ზუსტი ვარიანტი → ფასი / ფასდაკლება / მარაგი
  const configurable = hasVariants(product);
  const variant = configurable ? resolveVariant(product, selection) : null;
  const shown = variant
    ? { price: variant.price, oldPrice: variant.oldPrice, onSale: product.onSale }
    : { price: product.price, oldPrice: product.oldPrice, onSale: product.onSale };
  const discount = configurable
    ? variant
      ? productDiscount({ ...shown, discountPercent: undefined })
      : 0
    : productDiscount(product);
  const range = configurable ? priceRange(product) : null;
  const inStock = configurable ? (variant ? isAvailable(variant) : product.inStock) : product.inStock;
  const maxQty = variant ? Math.max(1, Math.min(99, variant.stock)) : 99;
  // არჩევანი სრულია, მაგრამ ასეთი კომბინაცია არ არსებობს (არასავალდებულო ოფციის გამო შესაძლებელია)
  const noSuchCombo = configurable && !variant && !firstMissingOption(product, selection);

  const onSelect = (option, valueId) => {
    setMissingOptionId(null);
    setSelection((sel) => {
      if (!valueId) {
        const { [option._id]: _removed, ...rest } = sel;
        return rest;
      }
      return selectValue(product, sel, option, valueId);
    });
  };

  const handleAdd = () => {
    if (configurable) {
      const missing = firstMissingOption(product, selection);
      if (missing) {
        setMissingOptionId(missing._id);
        document.getElementById(`option-group-${missing._id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (!variant || !isAvailable(variant)) return;
      addToCart(product, Math.min(quantity, maxQty), { variant, options: describeVariant(product, variant) });
      return;
    }
    addToCart(product, quantity);
  };

  const step = (dir) => {
    setZoom(false);
    setCurrentIndex((prev) => (prev + dir + images.length) % images.length);
  };

  const handleZoomMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  };

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label={t('common.breadcrumb')}>
        <Link to="/">{t('nav.home')}</Link>
        {product.category?.name && (
          <>
            <Icon name="chevronRight" size={14} />
            <Link to={`/category/${product.category.slug || product.category._id}`}>{categoryName}</Link>
          </>
        )}
        <Icon name="chevronRight" size={14} />
        <span className="current">{name}</span>
      </nav>

      <div className="pd">
        {/* Gallery */}
        <div className="gallery page-enter">
          <div
            className={`gallery-main ${zoom ? 'zoom' : ''}`}
            onClick={() => setZoom((z) => !z)}
            onMouseMove={zoom ? handleZoomMove : undefined}
            onMouseLeave={() => setZoom(false)}
          >
            <div className="pc-badges">
              {discount > 0 && <span className="pc-badge">-{discount}%</span>}
            </div>
            <img
              key={currentIndex}
              src={images[currentIndex]}
              alt={name}
              style={{ transformOrigin: zoomOrigin }}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER;
              }}
            />
            {images.length > 1 && (
              <>
                <button
                  className="pc-arrow prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                  aria-label={t('product.prevImage')}
                >
                  <Icon name="chevronLeft" size={20} strokeWidth={2.5} />
                </button>
                <button
                  className="pc-arrow next"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  aria-label={t('product.nextImage')}
                >
                  <Icon name="chevronRight" size={20} strokeWidth={2.5} />
                </button>
                <span className="gallery-counter">
                  {currentIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="thumbs">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  className={`thumb ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={t('product.image', { n: idx + 1 })}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="pd-info page-enter" style={{ animationDelay: '80ms' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {product.category?.name && <span className="pill pill-neutral no-dot">{categoryName}</span>}
            <span className={`pill ${inStock ? 'pill-success' : 'pill-danger'}`} aria-live="polite">
              {variant
                ? inStock
                  ? variant.stock <= 5
                    ? t('product.inStockLeft', { count: variant.stock })
                    : t('product.inStock')
                  : t('product.variantSoldOut')
                : inStock
                  ? t('product.inStock')
                  : t('product.outOfStock')}
            </span>
          </div>

          <h1>{name}</h1>

          <div className="pd-price" aria-live="polite">
            {configurable && !variant && range.max > range.min ? (
              // სრულ არჩევამდე — ფასების დიაპაზონი
              <div className="price pd-price-range">
                <span className="price-now">
                  {formatPrice(range.min)} – {formatPrice(range.max)}
                </span>
              </div>
            ) : (
              <Price price={shown.price} oldPrice={shown.oldPrice} onSale={shown.onSale} />
            )}
            {discount > 0 && <span className="pd-save">{t('product.save', { amount: formatPrice(shown.oldPrice - shown.price) })}</span>}
            {discount > 0 && configurable && <span className="pill pill-accent no-dot">-{discount}%</span>}
          </div>
          {configurable && !variant && !noSuchCombo && <p className="pd-variant-hint muted">{t('product.chooseOptionsHint')}</p>}

          {configurable && (
            <VariantSelector product={product} selection={selection} onSelect={onSelect} missingOptionId={missingOptionId} />
          )}
          {noSuchCombo && <Alert type="warning">{t('product.noSuchCombination')}</Alert>}

          <div className="pd-buy">
            {inStock && !noSuchCombo && (
              <QuantityStepper value={Math.min(quantity, maxQty)} max={maxQty} onChange={setQuantity} />
            )}
            <button
              className="btn btn-primary btn-lg"
              disabled={!inStock || noSuchCombo}
              onClick={handleAdd}
              aria-describedby={missingOptionId ? `option-group-${missingOptionId}` : undefined}
            >
              <Icon name="cartPlus" size={20} />
              {inStock && !noSuchCombo ? t('product.addToCart') : t('product.soldOut')}
            </button>
          </div>

          <div className="pd-assure">
            <div>
              <Icon name="truck" size={20} /> {t('product.assureDelivery')}
            </div>
            <div>
              <Icon name="receipt" size={20} /> {t('product.assurePayment')}
            </div>
          </div>

          {specs.length > 0 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{t('product.specifications')}</h2>
              <dl className="specs" style={{ margin: 0 }}>
                {specs.map((spec, index) => (
                  <div className="spec-row" key={index}>
                    <dt>{spec.key}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {description && (
        <section className="pd-section card card-pad">
          <h2>{t('product.about')}</h2>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: description }} />
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
