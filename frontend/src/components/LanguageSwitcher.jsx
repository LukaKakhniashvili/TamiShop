import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { LANGUAGES } from '../i18n';

/* დროშები SVG-ით — emoji დროშები Windows-ზე არ ჩანს; SVG ყველა სისტემაზე ერთნაირია */
const FlagGE = () => (
  <svg viewBox="0 0 30 20" aria-hidden="true">
    <rect width="30" height="20" fill="#fff" />
    <path d="M13 0h4v20h-4zM0 8h30v4H0z" fill="#e8112d" />
    <path d="M5.6 2.6h1.8v1h1v1.8h-1v1h-1.8v-1h-1V3.6h1zM22.6 2.6h1.8v1h1v1.8h-1v1h-1.8v-1h-1V3.6h1zM5.6 13.6h1.8v1h1v1.8h-1v1h-1.8v-1h-1v-1.8h1zM22.6 13.6h1.8v1h1v1.8h-1v1h-1.8v-1h-1v-1.8h1z" fill="#e8112d" />
  </svg>
);

const FlagGB = () => {
  const clip = `uk-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 60 30" aria-hidden="true">
      <clipPath id={clip}>
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${clip})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
};

const FlagRU = () => (
  <svg viewBox="0 0 30 20" aria-hidden="true">
    <rect width="30" height="20" fill="#fff" />
    <rect y="6.67" width="30" height="6.67" fill="#0039a6" />
    <rect y="13.33" width="30" height="6.67" fill="#d52b1e" />
  </svg>
);

const FLAGS = { ka: FlagGE, en: FlagGB, ru: FlagRU };
export const Flag = ({ code }) => {
  const F = FLAGS[code] || FlagGE;
  return (
    <span className="flag">
      <F />
    </span>
  );
};

/**
 * ენის არჩევა (header). კომპაქტური dropdown დროშებით; მობილურზე მხოლოდ დროშა + კოდი.
 * ენის შეცვლა ცვლის UI-ს მაშინვე, გვერდის განახლების გარეშე; არჩევანი ინახება (src/i18n).
 */
const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listId = useId();
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector('.lang-trigger')?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll('.lang-option') || [])];
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    // ფოკუსი არჩეულ ენაზე
    requestAnimationFrame(() => ref.current?.querySelector('.lang-option[aria-checked="true"]')?.focus());
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (code) => {
    setOpen(false);
    if (code !== i18n.language) i18n.changeLanguage(code);
  };

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('nav.language')}: ${current.label}`}
        title={t('nav.language')}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag code={current.code} />
        <span className="lang-label">{current.label}</span>
        <span className="lang-short">{current.short}</span>
        <Icon name="chevronDown" size={14} className="chev" />
      </button>
      {open && (
        <div className="dropdown lang-menu" role="menu" id={listId} aria-label={t('nav.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === current.code}
              lang={l.code}
              className={`dropdown-item lang-option ${l.code === current.code ? 'active' : ''}`}
              onClick={() => choose(l.code)}
            >
              <Flag code={l.code} />
              <span>{l.label}</span>
              {l.code === current.code && <Icon name="check" size={16} className="lang-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
