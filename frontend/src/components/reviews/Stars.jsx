import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

const STARS = [1, 2, 3, 4, 5];

/** ვარსკვლავები (ჩვენება): წილადი საშუალოც სწორად ივსება (4.7 → მე-5 ვარსკვლავის 70%) */
export const Stars = ({ value = 0, size = 16, className = '' }) => {
  const { t } = useTranslation();
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className={`stars ${className}`} role="img" aria-label={t('reviews.ratingOutOf', { rating: v.toFixed(1).replace(/\.0$/, '') })}>
      {STARS.map((n) => {
        const fill = Math.max(0, Math.min(1, v - (n - 1)));
        return (
          <span key={n} className="star" style={{ width: size, height: size }}>
            <Icon name="star" size={size} strokeWidth={0} className="star-empty" />
            {fill > 0 && (
              <span className="star-fill" style={{ width: `${fill * 100}%` }}>
                <Icon name="star" size={size} strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};

/** კომპაქტური რეიტინგი ბარათებისთვის: ★ 4.7 (128); შეფასებების გარეშე — არაფერი */
export const RatingBadge = ({ rating, count, className = '' }) => {
  const { t } = useTranslation();
  if (!count) return null;
  return (
    <span className={`rating-badge ${className}`} title={t('reviews.ratingSummary', { rating: Number(rating).toFixed(1), count })}>
      <Icon name="star" size={14} strokeWidth={0} />
      <strong aria-hidden="true">{Number(rating).toFixed(1)}</strong>
      <span className="muted" aria-hidden="true">({count})</span>
      <span className="sr-only">{t('reviews.ratingSummary', { rating: Number(rating).toFixed(1), count })}</span>
    </span>
  );
};

/** ვარსკვლავების არჩევა (რადიო-ჯგუფი — კლავიატურით ისრებით, ეკრანის წამკითხველით) */
export const StarInput = ({ value, onChange, disabled, invalid, describedBy }) => {
  const { t } = useTranslation();
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div
      className={`star-input ${invalid ? 'is-invalid' : ''}`}
      role="radiogroup"
      aria-label={t('reviews.rating')}
      aria-describedby={describedBy}
      onMouseLeave={() => setHover(0)}
    >
      {STARS.map((n) => (
        <label key={n} className={`star-input-item ${n <= shown ? 'on' : ''}`} onMouseEnter={() => !disabled && setHover(n)}>
          <input
            type="radio"
            name="review-rating"
            value={n}
            checked={value === n}
            disabled={disabled}
            onChange={() => onChange(n)}
            aria-label={t('reviews.starLabel', { count: n })}
          />
          <Icon name="star" size={30} strokeWidth={0} />
        </label>
      ))}
      <span className="star-input-text" aria-hidden="true">
        {shown ? t(`reviews.ratingWords.${shown}`) : t('reviews.chooseRating')}
      </span>
    </div>
  );
};
