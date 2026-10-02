import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { useWishlist } from '../context/WishlistContext';

/**
 * რჩეულების გული — ერთი კომპონენტი ბარათისა და პროდუქტის გვერდისთვის (საერთო მდგომარეობიდან).
 * variant="icon" — ბარათზე (მრგვალი ღილაკი), variant="button" — პროდუქტის გვერდზე (ტექსტით).
 */
const WishlistButton = ({ productId, variant = 'icon', className = '' }) => {
  const { t } = useTranslation();
  const { isWishlisted, toggle, isBusy } = useWishlist();
  const active = isWishlisted(productId);
  const label = active ? t('wishlist.remove') : t('wishlist.add');

  const onClick = (e) => {
    // ბარათზე: ნავიგაცია/მშობლის დაჭერა არ უნდა მოხდეს
    e.preventDefault();
    e.stopPropagation();
    toggle(productId);
  };

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`btn btn-lg wish-btn ${active ? 'active' : ''} ${className}`}
        onClick={onClick}
        aria-pressed={active}
        disabled={isBusy(productId)}
        title={label}
      >
        <Icon name="heart" size={20} />
        <span>{active ? t('wishlist.inWishlist') : t('wishlist.add')}</span>
      </button>
    );
  }
  return (
    <button type="button" className={`pc-wish ${active ? 'active' : ''} ${className}`} onClick={onClick} aria-pressed={active} aria-label={label} title={label}>
      <Icon name="heart" size={18} />
    </button>
  );
};

export default WishlistButton;
