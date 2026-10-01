import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useLocalized } from '../i18n/content';
import Icon from './Icon';
import { Price, formatPrice, productDiscount } from './ui';

const PLACEHOLDER = 'https://placehold.co/400x400?text=No+Image';

/**
 * @param highlight  გამოკვეთილი ფასდაკლება (დიდი -X% და დაზოგვის თანხა) — ცხელი შეთავაზებებისთვის
 * @param rank       რიგითი ნომერი (#1, #2...) — ბესტსელერებისთვის
 * "ახალი" ბეჯი ავტომატურია: product.isNew-ს API ითვლის (ბოლო 14 დღეში დამატებული)
 */
const ProductCard = ({ product, index = 0, highlight = false, rank }) => {
  const { t } = useTranslation();
  const L = useLocalized();
  const { addToCart } = useCart();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef(null);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  const name = L(product, 'name');
  const images = product.images?.length ? product.images : [product.image || PLACEHOLDER];
  const href = `/product/${product.slug || product._id}`;
  const discount = productDiscount(product);

  const step = (e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + dir + images.length) % images.length);
  };

  const handleAdd = () => {
    addToCart(product, 1);
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article
      className={`product-card reveal ${product.inStock ? '' : 'out'} ${highlight ? 'deal' : ''}`}
      style={{ '--i': index }}
    >
      <div className="pc-media">
        <div className="pc-badges">
          {rank && <span className="pc-badge rank-badge">#{rank}</span>}
          {discount > 0 && <span className={`pc-badge ${highlight ? 'deal-badge' : ''}`}>-{discount}%</span>}
          {product.isNew && <span className="pc-badge new-badge">{t('product.new')}</span>}
          {!product.inStock && <span className="pc-badge muted-badge">{t('product.soldOut')}</span>}
        </div>

        <Link to={href} aria-label={name}>
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={i === 0 ? name : ''}
              loading="lazy"
              className={i === currentIndex ? 'current' : 'hidden'}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER;
              }}
            />
          ))}
        </Link>

        {images.length > 1 && (
          <>
            <button className="pc-arrow prev" onClick={(e) => step(e, -1)} aria-label={t('product.prevImage')}>
              <Icon name="chevronLeft" size={16} strokeWidth={2.5} />
            </button>
            <button className="pc-arrow next" onClick={(e) => step(e, 1)} aria-label={t('product.nextImage')}>
              <Icon name="chevronRight" size={16} strokeWidth={2.5} />
            </button>
            <div className="pc-dots">
              {images.map((_, i) => (
                <span key={i} className={i === currentIndex ? 'on' : ''} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="pc-body">
        {product.category?.name && <span className="pc-cat">{L(product.category, 'name')}</span>}
        <Link to={href} className="pc-name">
          {name}
        </Link>
        {highlight && discount > 0 && (
          <span className="pc-save">{t('product.save', { amount: formatPrice(product.oldPrice - product.price) })}</span>
        )}
        <div className="pc-foot">
          <div className="pc-price">
            {/* ვარიანტიანზე — ყველაზე იაფი ხელმისაწვდომი ვარიანტის ფასი „-დან" */}
            {product.hasVariants && product.priceMax > product.price && <span className="pc-from">{t('product.from')}</span>}
            <Price price={product.price} oldPrice={product.oldPrice} onSale={product.onSale} />
          </div>
          {product.hasVariants ? (
            // პარამეტრების არჩევა სავალდებულოა — ბარათიდან პირდაპირ დამატება არ ხდება
            <Link
              to={href}
              className="add-btn"
              aria-label={t('product.chooseOptionsFor', { name })}
              title={t('product.chooseOptions')}
            >
              <Icon name="sliders" size={18} strokeWidth={2.2} />
            </Link>
          ) : (
            <button
              className={`add-btn ${added ? 'added' : ''}`}
              disabled={!product.inStock}
              onClick={handleAdd}
              aria-label={product.inStock ? t('product.addToCart') : t('product.soldOut')}
              title={product.inStock ? t('product.addToCart') : t('product.soldOut')}
            >
              <Icon name={added ? 'check' : 'cartPlus'} size={18} strokeWidth={2.2} key={added ? 'c' : 'p'} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
