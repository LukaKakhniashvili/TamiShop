import { useTranslation } from 'react-i18next';
import { useLocalized } from '../i18n/content';
import { valueStatus } from '../utils/variants';

/**
 * ოფციების არჩევა პროდუქტის გვერდზე. თითო ოფცია — radiogroup; ფერებისთვის ნიმუშები (სახელით).
 * მნიშვნელობის მდგომარეობა (utils/variants.valueStatus): ხელმისაწვდომი / ამოწურული / შეუთავსებელი / მიუწვდომელი.
 * ოფციის სახელები/მნიშვნელობები — თარგმანით (option.translations / value.translations), fallback ქართული.
 */
const VariantSelector = ({ product, selection, onSelect, missingOptionId }) => {
  const { t } = useTranslation();
  const L = useLocalized();
  const hint = { soldout: t('variants.soldOut'), conflict: t('variants.conflict'), unavailable: t('variants.unavailable') };

  return (
    <div className="variant-selector">
      {product.options.map((option) => {
        const selected = option.values.find((v) => v._id === selection[option._id]);
        const invalid = missingOptionId === option._id;
        const optionName = L(option, 'name');
        return (
          <div
            key={option._id}
            className={`variant-option ${invalid ? 'is-missing' : ''}`}
            role="radiogroup"
            aria-labelledby={`opt-${option._id}`}
            aria-invalid={invalid || undefined}
            id={`option-group-${option._id}`}
          >
            <div className="variant-option-head" id={`opt-${option._id}`}>
              <span className="variant-option-name">
                {optionName}
                {option.required && <span className="req" aria-hidden="true">*</span>}
              </span>
              <span className={`variant-option-value ${selected ? '' : 'muted'}`}>
                {selected ? L(selected, 'label') : option.required ? t('variants.choose') : t('variants.optional')}
              </span>
            </div>
            <div className={`variant-values ${option.display === 'swatch' ? 'swatches' : 'chips'}`}>
              {option.values.map((value) => {
                const status = valueStatus(product, selection, option, value._id);
                const isSelected = selection[option._id] === value._id;
                const label = L(value, 'label');
                return (
                  <button
                    key={value._id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={status === 'unavailable'}
                    className={`variant-value status-${status} ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelect(option, isSelected && !option.required ? null : value._id)}
                    title={hint[status] ? `${label} — ${hint[status]}` : label}
                  >
                    {option.display === 'swatch' && value.color && (
                      <span className="variant-swatch" style={{ background: value.color }} aria-hidden="true" />
                    )}
                    <span className="variant-value-label">{label}</span>
                    {status === 'soldout' && <span className="sr-only"> ({t('variants.soldOut')})</span>}
                  </button>
                );
              })}
            </div>
            {invalid && (
              <span className="field-error" role="alert">
                {t('variants.pleaseSelect', { name: optionName })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VariantSelector;
