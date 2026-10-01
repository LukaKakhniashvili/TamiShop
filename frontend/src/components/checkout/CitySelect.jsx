import { useEffect, useId, useMemo, useRef, useState } from 'react';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

// ქალაქის საჩვენებელი სახელი: ქართულად — ქართული, სხვა ენაზე — ლათინური.
// შეკვეთაში ყოველთვის ქართული სახელი (name) იგზავნება.
export const cityLabel = (cities = [], name, lng) => {
  if (!name) return '';
  const lang = lng || i18n.language;
  if (lang === 'ka') return name;
  return cities.find((c) => c.name === name)?.latin || name;
};

/**
 * ძებნადი ქალაქის ამომრჩევი (combobox). ეძებს ქართულად და ლათინურად ("tbil" → თბილისი).
 * @param cities  [{ name, latin }] — სერვერიდან (GET /api/order-checkout-options)
 */
const CitySelect = ({ cities = [], value, onChange, invalid, placeholder, id }) => {
  const { t, i18n: inst } = useTranslation();
  const isKa = inst.language === 'ka';
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q) || c.latin.toLowerCase().includes(q));
  }, [cities, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = Math.max(0, cities.findIndex((c) => c.name === value));
    setActive(idx);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      listRef.current?.children[idx]?.scrollIntoView({ block: 'nearest' });
    });
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const choose = (city) => {
    onChange(city.name);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(filtered.length - 1, Math.max(0, active + (e.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`city-select ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`input city-trigger ${invalid ? 'is-invalid' : ''} ${value ? '' : 'placeholder'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="pin" size={18} />
        <span>{value ? cityLabel(cities, value, inst.language) : placeholder || t('checkout.chooseCity')}</span>
        <Icon name="chevronDown" size={16} className="chev" />
      </button>

      {open && (
        <div className="city-pop">
          <div className="input-group">
            <span className="input-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              ref={searchRef}
              className="input input-sm"
              placeholder={t('checkout.searchCity')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-controls={listId}
              aria-expanded="true"
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
            />
          </div>
          <ul className="city-list" role="listbox" id={listId} ref={listRef}>
            {filtered.map((c, i) => (
              <li
                key={c.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={c.name === value}
                className={`${i === active ? 'active' : ''} ${c.name === value ? 'selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(c);
                }}
              >
                <span>{isKa ? c.name : c.latin}</span>
                <small>{isKa ? c.latin : c.name}</small>
                {c.name === value && <Icon name="check" size={16} />}
              </li>
            ))}
            {filtered.length === 0 && <li className="city-empty">{t('checkout.cityNotFound')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CitySelect;
