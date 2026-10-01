import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { trackProductView } from '../utils/activity';
import Icon from '../components/Icon';
import { EmptyState, Price, QuantityStepper, formatPrice, productDiscount } from '../components/ui';

const PLACEHOLDER = 'https://placehold.co/600x600?text=No+Image';

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
  const { addToCart } = useCart();

  useEffect(() => {
    setProduct(null);
    setNotFound(false);
    setCurrentIndex(0);
    setQuantity(1);
    api
      .get(`/product-details/${id}`)
      .then(({ data }) => {
        setProduct(data);
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
        <EmptyState icon="box" title="პროდუქტი ვერ მოიძებნა" text="შესაძლოა პროდუქტი წაიშალა ან ბმული არასწორია.">
          <Link to="/" className="btn btn-primary">
            მაღაზიაში დაბრუნება
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

  const discount = productDiscount(product);
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
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link to="/">მთავარი</Link>
        {product.category?.name && (
          <>
            <Icon name="chevronRight" size={14} />
            <Link to={`/category/${product.category.slug || product.category._id}`}>{product.category.name}</Link>
          </>
        )}
        <Icon name="chevronRight" size={14} />
        <span className="current">{product.name}</span>
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
              alt={product.name}
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
                  aria-label="წინა სურათი"
                >
                  <Icon name="chevronLeft" size={20} strokeWidth={2.5} />
                </button>
                <button
                  className="pc-arrow next"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  aria-label="შემდეგი სურათი"
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
                  aria-label={`სურათი ${idx + 1}`}
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
            {product.category?.name && <span className="pill pill-neutral no-dot">{product.category.name}</span>}
            <span className={`pill ${product.inStock ? 'pill-success' : 'pill-danger'}`}>
              {product.inStock ? 'მარაგშია' : 'არ არის მარაგში'}
            </span>
          </div>

          <h1>{product.name}</h1>

          <div className="pd-price">
            <Price price={product.price} oldPrice={product.oldPrice} onSale={product.onSale} />
            {discount > 0 && <span className="pd-save">დაზოგე {formatPrice(product.oldPrice - product.price)}</span>}
          </div>

          <div className="pd-buy">
            {product.inStock && <QuantityStepper value={quantity} onChange={setQuantity} />}
            <button className="btn btn-primary btn-lg" disabled={!product.inStock} onClick={() => addToCart(product, quantity)}>
              <Icon name="cartPlus" size={20} />
              {product.inStock ? 'კალათაში დამატება' : 'ამოწურულია'}
            </button>
          </div>

          <div className="pd-assure">
            <div>
              <Icon name="truck" size={20} /> უფასო მიწოდება მთელ საქართველოში
            </div>
            <div>
              <Icon name="receipt" size={20} /> გადახდა კურიერთან, მიღებისას
            </div>
          </div>

          {product.specifications?.length > 0 && (
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>მახასიათებლები</h2>
              <dl className="specs" style={{ margin: 0 }}>
                {product.specifications.map((spec, index) => (
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

      {product.description && (
        <section className="pd-section card card-pad">
          <h2>პროდუქტის შესახებ</h2>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: product.description }} />
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
