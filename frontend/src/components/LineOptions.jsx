import { useLocalized } from '../i18n/content';

/**
 * არჩეული ვარიანტის აღწერა (კალათა, checkout, შეკვეთები): „ფერი: შავი · მეხსიერება: 256 GB".
 * შეკვეთებში ეს ისტორიული snapshot-ია (order.items[].variant.options). თარგმანი — თუ შენახულია,
 * წინააღმდეგ შემთხვევაში საბაზისო (ქართული) ტექსტი.
 */
const LineOptions = ({ options, className = '' }) => {
  const L = useLocalized();
  if (!options?.length) return null;
  return (
    <span className={`line-options ${className}`}>
      {options.map((o, i) => (
        <span key={`${o.name}-${i}`} className="line-option">
          <span className="line-option-name">{L(o, 'name')}:</span> {L(o, 'value')}
        </span>
      ))}
    </span>
  );
};

export default LineOptions;
