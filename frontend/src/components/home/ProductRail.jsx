import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProductCard from '../ProductCard';
import Icon from '../Icon';

// სექცია ეკრანზე გამოჩენისას იღებს კლასს `in` — ბარათების ანიმაცია მხოლოდ მაშინ იწყება
const useInView = () => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -80px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return [ref, inView];
};

const RailSkeleton = () =>
  Array.from({ length: 5 }).map((_, i) => (
    <div className="skel-card rail-item" key={i}>
      <div className="skeleton media" />
      <div className="body">
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
        <div className="skeleton" style={{ height: 14, width: '90%' }} />
        <div className="skeleton" style={{ height: 18, width: '35%', marginTop: 12 }} />
      </div>
    </div>
  ));

/**
 * ჰორიზონტალური პროდუქტების სექცია მთავარ გვერდზე.
 * @param products    პროდუქტების მასივი (null — იტვირთება)
 * @param cardProps   (product, index) => დამატებითი props ProductCard-ისთვის
 * @param empty       რა გამოჩნდეს ცარიელი სიის დროს (თუ არ არის მითითებული, სექცია იმალება)
 * @param variant     'deals' — გამოკვეთილი დიზაინი
 */
const ProductRail = ({ id, icon, eyebrow, title, subtitle, action, products, cardProps, empty, variant }) => {
  const { t } = useTranslation();
  const [sectionRef, inView] = useInView();
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const updateEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [products, updateEdges]);

  const scrollBy = (dir) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const isEmpty = products && products.length === 0;
  if (isEmpty && !empty) return null;

  return (
    <section id={id} ref={sectionRef} className={`rail-section ${variant ? `rail-${variant}` : ''} ${inView ? 'in' : ''}`}>
      <div className="rail-head">
        <div className="rail-title">
          {icon && (
            <span className="rail-icon">
              <Icon name={icon} size={20} />
            </span>
          )}
          <div>
            {eyebrow && <span className="rail-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <div className="rail-actions">
          {action && !isEmpty && (
            <button type="button" className="rail-link" onClick={action.onClick}>
              {action.label} <Icon name="arrowRight" size={16} />
            </button>
          )}
          {!isEmpty && (
            <div className="rail-arrows">
              <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={t('common.previous')}>
                <Icon name="chevronLeft" size={18} />
              </button>
              <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label={t('common.next')}>
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="rail-empty">{empty}</div>
      ) : (
        <div className="rail-track" ref={trackRef} onScroll={updateEdges}>
          {products
            ? products.map((p, i) => (
                <div className="rail-item" key={p._id}>
                  <ProductCard product={p} index={Math.min(i, 6)} {...(cardProps ? cardProps(p, i) : {})} />
                </div>
              ))
            : <RailSkeleton />}
        </div>
      )}
    </section>
  );
};

export default ProductRail;
