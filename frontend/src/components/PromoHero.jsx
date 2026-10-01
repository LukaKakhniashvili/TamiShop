import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';

const SLIDE_DURATION = 6000;

const ALL_SLIDES = [
  {
    eyebrow: 'ცხელი შეთავაზება',
    title: (
      <>
        MEGA <em>SALE</em>
      </>
    ),
    subtitle: 'ტექნიკა და აქსესუარები საუკეთესო ფასად',
    big: '-40%',
    bg: 'linear-gradient(125deg, #e2572c 0%, #b8391a 55%, #7d2410 100%)',
    accent: '#ffe0b8',
    countdown: true,
  },
  {
    eyebrow: 'უფასო მიწოდება',
    title: (
      <>
        სწრაფი <em>კურიერი</em>
      </>
    ),
    subtitle: 'ნებისმიერ შეკვეთაზე მთელ საქართველოში — 2–6 სამუშაო დღეში',
    big: '0 ₾',
    bg: 'linear-gradient(125deg, #23805c 0%, #145740 55%, #0b3528 100%)',
    accent: '#b9f5d6',
  },
  {
    // ქეშბექი პირველ რელიზში არ არის ხელმისაწვდომი — ჩასართავად: enabled: true
    enabled: false,
    eyebrow: 'VIP ქეშბექი',
    title: (
      <>
        დაიბრუნე <em>10%</em>
      </>
    ),
    subtitle: 'ყველა ავტორიზებულ მომხმარებელზე თითოეულ შენაძენზე',
    big: '10%',
    bg: 'linear-gradient(125deg, #4a37a0 0%, #2e2170 55%, #1a1342 100%)',
    accent: '#d8ccff',
  },
];

// მხოლოდ აქტიური სლაიდები (enabled: false — დამალულია, მაგრამ კოდში რჩება)
const slides = ALL_SLIDES.filter((s) => s.enabled !== false);

const Countdown = () => {
  const [left, setLeft] = useState(4 * 3600 + 28 * 60 + 45);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 12 * 3600)), 1000);
    return () => clearInterval(t);
  }, []);

  const parts = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60];
  const labels = ['სთ', 'წთ', 'წმ'];

  return (
    <div className="hero-timer" aria-label="აქცია მთავრდება">
      {parts.map((v, i) => (
        <div key={labels[i]} className="hero-timer-box">
          <strong>{String(v).padStart(2, '0')}</strong>
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
};

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PromoHero = ({ onCta }) => {
  const [current, setCurrent] = useState(0);

  const go = useCallback((i) => setCurrent((i + slides.length) % slides.length), []);

  // Auto-advance is driven by the progress bar's CSS animation, so pausing on hover
  // (animation-play-state) keeps the bar and the slide change in sync.
  const handleProgressEnd = () => {
    if (!reducedMotion) go(current + 1);
  };

  return (
    <section className="hero" style={{ '--hero-dur': `${SLIDE_DURATION}ms` }} aria-roledescription="carousel">
      {slides.map((s, i) => (
        <div
          key={i}
          className={`hero-slide ${i === current ? 'active' : ''}`}
          style={{ '--slide-bg': s.bg, '--hero-accent': s.accent }}
          aria-hidden={i !== current}
        >
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <Icon name="sparkle" size={14} /> {s.eyebrow}
            </span>
            <h2 className="hero-title">{s.title}</h2>
            <p className="hero-sub">{s.subtitle}</p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-lg hero-cta" onClick={onCta} tabIndex={i === current ? 0 : -1}>
                იყიდე ახლა <Icon name="arrowRight" size={18} />
              </button>
              {s.countdown && i === current && <Countdown />}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-orb o1" />
            <span className="hero-orb o2" />
            <span className="hero-orb o3" />
            <span className="hero-big">{s.big}</span>
          </div>
        </div>
      ))}

      {/* ნავიგაცია მხოლოდ რამდენიმე სლაიდის შემთხვევაში */}
      {slides.length > 1 && (
        <>
          <div className="hero-controls">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`hero-dot ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}
                onClick={() => go(i)}
                aria-label={`სლაიდი ${i + 1}`}
              >
                <span onAnimationEnd={i === current ? handleProgressEnd : undefined} />
              </button>
            ))}
          </div>
          <div className="hero-arrows">
            <button onClick={() => go(current - 1)} aria-label="წინა">
              <Icon name="chevronLeft" size={18} />
            </button>
            <button onClick={() => go(current + 1)} aria-label="შემდეგი">
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default PromoHero;
