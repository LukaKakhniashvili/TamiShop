import RichTextEditor from '../RichTextEditor';
import { Field, Tabs } from '../ui';
import { Flag } from '../LanguageSwitcher';

/*
 * ადმინი → მრავალენოვანი კონტენტი: ქართული | English | Русский.
 *   ქართული — საბაზისო ველები (name, description, specifications, options) — სავალდებულო და fallback.
 *   English / Русский — translations.{en,ru}. ცარიელი ველის ნაცვლად მომხმარებელი ქართულ ტექსტს ხედავს.
 * ჩანართზე წერტილი (•) — ამ ენაზე თარგმანი არასრულია.
 */

export const CONTENT_LANGUAGES = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

const LangTabs = ({ lang, onChange, incomplete = {} }) => (
  <Tabs
    active={lang}
    onChange={onChange}
    tabs={CONTENT_LANGUAGES.map((l) => ({
      id: l.code,
      label: (
        <span className="tr-tab">
          <Flag code={l.code} /> {l.label}
          {incomplete[l.code] && (
            <span className="tr-missing" title="თარგმანი არასრულია" aria-label="თარგმანი არასრულია">
              •
            </span>
          )}
        </span>
      ),
    }))}
  />
);

const filled = (v) => typeof v === 'string' && v.trim() !== '';

/** რომელ ენაზეა თარგმანი არასრული (სახელი, აღწერა, მახასიათებლები, ოფციები) */
const productIncomplete = (form) =>
  Object.fromEntries(
    ['en', 'ru'].map((lng) => {
      const tr = form.translations?.[lng] || {};
      const missing =
        (filled(form.name) && !filled(tr.name)) ||
        (filled(form.description?.replace(/<[^>]*>/g, '')) && !filled(tr.description?.replace(/<[^>]*>/g, ''))) ||
        (form.specifications || []).some((s, i) => (s.key && !filled(tr.specifications?.[i]?.key)) || (s.value && !filled(tr.specifications?.[i]?.value))) ||
        (form.options || []).some((o) => !filled(o.translations?.[lng]?.name));
      return [lng, missing];
    })
  );

/**
 * პროდუქტის კონტენტი სამ ენაზე: სახელი, აღწერა; EN/RU — ასევე მახასიათებლები და ოფციები.
 * @param form      AdminProducts-ის ფორმა
 * @param setForm   ფუნქციური განახლება
 * @param lang      აქტიური ჩანართი (მშობელი მართავს — ვალიდაციისას ქართულზე გადასართავად)
 */
export const ProductContentEditor = ({ form, setForm, lang, onLangChange, editorKey }) => {
  const isBase = lang === 'ka';
  const tr = form.translations?.[lang] || {};
  const setTr = (patch) =>
    setForm((prev) => ({
      ...prev,
      translations: { ...prev.translations, [lang]: { ...(prev.translations?.[lang] || {}), ...patch } },
    }));
  const setSpec = (index, key, value) =>
    setForm((prev) => {
      const cur = prev.translations?.[lang] || {};
      const specs = prev.specifications.map((_, i) => ({ key: '', value: '', ...(cur.specifications?.[i] || {}) }));
      specs[index] = { ...specs[index], [key]: value };
      return { ...prev, translations: { ...prev.translations, [lang]: { ...cur, specifications: specs } } };
    });
  const setOptionTr = (optionId, field, value, valueId) =>
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o) => {
        if (o._id !== optionId) return o;
        if (!valueId) return { ...o, translations: { ...o.translations, [lang]: { ...(o.translations?.[lang] || {}), [field]: value } } };
        return {
          ...o,
          values: o.values.map((v) =>
            v._id === valueId ? { ...v, translations: { ...v.translations, [lang]: { ...(v.translations?.[lang] || {}), [field]: value } } } : v
          ),
        };
      }),
    }));

  return (
    <div className="tr-editor">
      <LangTabs lang={lang} onChange={onLangChange} incomplete={productIncomplete(form)} />
      <div className="form-stack" lang={lang}>
        {isBase ? (
          <Field label="სახელი" required>
            <input
              className="input"
              name="name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              maxLength={200}
            />
          </Field>
        ) : (
          <Field label="სახელი" hint={form.name ? `ქართულად: ${form.name}` : undefined}>
            <input className="input" value={tr.name || ''} onChange={(e) => setTr({ name: e.target.value })} maxLength={200} placeholder={form.name} />
          </Field>
        )}

        <div className="field">
          <span className="field-label">აღწერა</span>
          {isBase ? (
            <RichTextEditor key={`${editorKey}-ka`} defaultValue={form.description} onChange={(val) => setForm((prev) => ({ ...prev, description: val }))} />
          ) : (
            <RichTextEditor key={`${editorKey}-${lang}`} defaultValue={tr.description || ''} onChange={(val) => setTr({ description: val })} />
          )}
        </div>

        {isBase ? (
          <p className="muted tr-note">მახასიათებლები და ოფციები ქართულად — ქვემოთ, შესაბამის სექციებში. მათი თარგმანები — English / Русский ჩანართებში.</p>
        ) : (
          <>
            {form.specifications?.length > 0 && (
              <div className="field">
                <span className="field-label">მახასიათებლები</span>
                <div className="form-stack" style={{ gap: 8 }}>
                  {form.specifications.map((spec, i) => (
                    <div key={i} className="spec-edit tr-spec">
                      <input
                        className="input input-sm"
                        placeholder={spec.key || 'მახასიათებელი'}
                        value={tr.specifications?.[i]?.key || ''}
                        onChange={(e) => setSpec(i, 'key', e.target.value)}
                        aria-label={`${spec.key} — თარგმანი`}
                      />
                      <input
                        className="input input-sm"
                        placeholder={spec.value || 'მნიშვნელობა'}
                        value={tr.specifications?.[i]?.value || ''}
                        onChange={(e) => setSpec(i, 'value', e.target.value)}
                        aria-label={`${spec.value} — თარგმანი`}
                      />
                    </div>
                  ))}
                </div>
                <span className="field-hint">ტექნიკური მნიშვნელობები (128 GB, 6.7&quot;, USB-C...) შეგიძლიათ დატოვოთ უცვლელი.</span>
              </div>
            )}

            {form.options?.length > 0 && (
              <div className="field">
                <span className="field-label">ოფციები და მნიშვნელობები</span>
                <div className="tr-options">
                  {form.options.map((o) => (
                    <div key={o._id} className="tr-option">
                      <input
                        className="input input-sm tr-option-name"
                        placeholder={o.name || 'ოფცია'}
                        value={o.translations?.[lang]?.name || ''}
                        onChange={(e) => setOptionTr(o._id, 'name', e.target.value)}
                        aria-label={`ოფცია „${o.name}" — თარგმანი`}
                        maxLength={40}
                      />
                      <div className="tr-values">
                        {o.values.map((v) => (
                          <input
                            key={v._id}
                            className="input input-sm"
                            placeholder={v.label || 'მნიშვნელობა'}
                            value={v.translations?.[lang]?.label || ''}
                            onChange={(e) => setOptionTr(o._id, 'label', e.target.value, v._id)}
                            aria-label={`„${v.label}" — თარგმანი`}
                            maxLength={40}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <span className="field-hint">ენისგან დამოუკიდებელი მნიშვნელობები (128 GB, XL...) შეგიძლიათ დატოვოთ ცარიელი.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/** კატეგორიის კონტენტი სამ ენაზე: სახელი, აღწერა */
export const CategoryContentEditor = ({ form, setForm, lang, onLangChange }) => {
  const isBase = lang === 'ka';
  const tr = form.translations?.[lang] || {};
  const set = (patch) =>
    setForm((f) => (isBase ? { ...f, ...patch } : { ...f, translations: { ...f.translations, [lang]: { ...(f.translations?.[lang] || {}), ...patch } } }));
  const value = (field) => (isBase ? form[field] : tr[field]) || '';
  const incomplete = Object.fromEntries(
    ['en', 'ru'].map((lng) => {
      const t = form.translations?.[lng] || {};
      return [lng, (filled(form.name) && !filled(t.name)) || (filled(form.description) && !filled(t.description))];
    })
  );
  return (
    <div className="tr-editor">
      <LangTabs lang={lang} onChange={onLangChange} incomplete={incomplete} />
      <div className="form-stack" lang={lang}>
        <Field label="სახელი" required={isBase} hint={!isBase && form.name ? `ქართულად: ${form.name}` : undefined}>
          <input className="input" value={value('name')} onChange={(e) => set({ name: e.target.value })} required={isBase} maxLength={100} placeholder={isBase ? '' : form.name} />
        </Field>
        <Field label="აღწერა">
          <textarea className="textarea" rows={3} value={value('description')} placeholder={isBase ? '' : form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
    </div>
  );
};

export const TranslationsHint = () => (
  <p className="muted ve-intro">
    ქართული ველები სავალდებულოა. English / Русский — მომხმარებელი ხედავს არჩეულ ენაზე; ცარიელი ველის ნაცვლად ქართული ტექსტი ჩანს.
  </p>
);
