import { useState } from 'react';
import Icon from '../Icon';
import { formatPrice } from '../ui';
import { newId } from '../../utils/variants';

/*
 * ადმინი → პროდუქტი → „ოფციები და ვარიანტები" (არასავალდებულო).
 *   options  — ნებისმიერი სახელის ოფცია (ფერი, მეხსიერება, ზომა, მოცულობა...) მნიშვნელობებით
 *   variants — დასაშვები კომბინაციები: ფასი, ძველი ფასი, მარაგი, SKU, აქტიურობა
 * იდენტიფიკატორები იქმნება კლიენტზე (newId), რომ ვარიანტებმა ახალ მნიშვნელობებზე მიუთითონ შენახვამდე.
 * საბოლოო ვალიდაციას აკეთებს სერვერი (backend/services/productVariants.js) — აქ იგივე წესები UI-სთვის.
 */

export const MAX_VARIANTS = 500;

const comboKey = (options, variant) => options.map((o) => variant.values.find((id) => o.values.some((v) => v._id === id)) || '-').join('|');

/** კლიენტის ვალიდაცია — აბრუნებს შეცდომების სიას (ცარიელი = OK) */
export const validateVariantConfig = (options, variants, { onSale }) => {
  const errors = [];
  const names = new Set();
  options.forEach((o, i) => {
    const name = o.name.trim();
    if (!name) errors.push(`ოფცია #${i + 1}: მიუთითეთ სახელი`);
    else if (names.has(name.toLocaleLowerCase())) errors.push(`ოფცია „${name}" მეორდება`);
    names.add(name.toLocaleLowerCase());
    if (!o.values.length) errors.push(`ოფცია „${name || i + 1}": დაამატეთ მინიმუმ ერთი მნიშვნელობა`);
    const labels = new Set();
    o.values.forEach((v) => {
      const label = v.label.trim();
      if (!label) errors.push(`ოფცია „${name}": ცარიელი მნიშვნელობა`);
      else if (labels.has(label.toLocaleLowerCase())) errors.push(`ოფცია „${name}": მნიშვნელობა „${label}" მეორდება`);
      labels.add(label.toLocaleLowerCase());
    });
  });
  if (options.length && !variants.length) errors.push('დაამატეთ მინიმუმ ერთი ვარიანტი (მაგ. „კომბინაციების გენერირება")');
  const combos = new Set();
  const skus = new Set();
  variants.forEach((v, i) => {
    const n = i + 1;
    options.forEach((o) => {
      if (o.required && !o.values.some((x) => v.values.includes(x._id))) errors.push(`ვარიანტი #${n}: აირჩიეთ „${o.name || '?'}"`);
    });
    const key = comboKey(options, v);
    if (combos.has(key)) errors.push(`ვარიანტი #${n}: ასეთი კომბინაცია უკვე არსებობს`);
    combos.add(key);
    if (v.price === '' || Number(v.price) < 0 || Number.isNaN(Number(v.price))) errors.push(`ვარიანტი #${n}: მიუთითეთ ფასი (0 ან მეტი)`);
    if (onSale && v.oldPrice !== '' && v.oldPrice !== null && Number(v.oldPrice) <= Number(v.price)) {
      errors.push(`ვარიანტი #${n}: ძველი ფასი უნდა აღემატებოდეს მიმდინარეს`);
    }
    if (v.stock !== '' && (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0)) errors.push(`ვარიანტი #${n}: მარაგი — მთელი რიცხვი, 0 ან მეტი`);
    const sku = (v.sku || '').trim().toLowerCase();
    if (sku && skus.has(sku)) errors.push(`SKU „${v.sku}" მეორდება`);
    if (sku) skus.add(sku);
  });
  return errors;
};

/** API → ფორმის მდგომარეობა */
export const toEditorState = (product) => ({
  options: (product.options || []).map((o) => ({
    _id: o._id,
    name: o.name,
    required: o.required !== false,
    display: o.display || 'chip',
    values: o.values.map((v) => ({ _id: v._id, label: v.label, color: v.color || '', translations: v.translations || {} })),
    // EN/RU თარგმანები — რედაქტირდება „თარგმანების" სექციაში (TranslationsEditor)
    translations: o.translations || {},
  })),
  variants: (product.variants || []).map((v) => ({
    _id: v._id,
    values: v.values.map(String),
    price: v.price ?? '',
    oldPrice: v.oldPrice ?? '',
    stock: v.stock ?? 0,
    sku: v.sku || '',
    isActive: v.isActive !== false,
  })),
});

/** ფორმა → API */
export const toPayload = (options, variants, { onSale }) => ({
  options: options.map((o) => ({
    _id: o._id,
    name: o.name.trim(),
    required: o.required,
    display: o.display,
    values: o.values.map((v) => ({
      _id: v._id,
      label: v.label.trim(),
      color: o.display === 'swatch' && v.color ? v.color : null,
      translations: v.translations || {},
    })),
    translations: o.translations || {},
  })),
  variants: variants.map((v) => ({
    _id: v._id,
    values: v.values,
    price: Number(v.price),
    oldPrice: onSale && v.oldPrice !== '' && v.oldPrice !== null ? Number(v.oldPrice) : null,
    stock: v.stock === '' ? 0 : Number(v.stock),
    sku: (v.sku || '').trim(),
    isActive: v.isActive,
  })),
});

const ValueChip = ({ option, value, onChange, onRemove }) => (
  <div className="ve-value">
    {option.display === 'swatch' && (
      <input
        type="color"
        className="ve-color"
        value={value.color || '#888888'}
        onChange={(e) => onChange({ ...value, color: e.target.value })}
        aria-label={`${value.label || 'მნიშვნელობა'} — ფერი`}
      />
    )}
    <input
      className="input input-sm"
      value={value.label}
      onChange={(e) => onChange({ ...value, label: e.target.value })}
      aria-label={`${option.name || 'ოფცია'} — მნიშვნელობა`}
      maxLength={40}
    />
    <button type="button" className="ve-icon danger" onClick={onRemove} aria-label={`„${value.label}" წაშლა`} title="მნიშვნელობის წაშლა">
      <Icon name="x" size={14} />
    </button>
  </div>
);

const AddValue = ({ onAdd, placeholder }) => {
  const [draft, setDraft] = useState('');
  const submit = () => {
    // მძიმით გამოყოფილი რამდენიმე მნიშვნელობა ერთად: „128 GB, 256 GB, 512 GB"
    const labels = draft.split(',').map((s) => s.trim()).filter(Boolean);
    if (labels.length) onAdd(labels);
    setDraft('');
  };
  return (
    <div className="ve-add-value">
      <input
        className="input input-sm"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        aria-label="ახალი მნიშვნელობა"
      />
      <button type="button" className="btn btn-sm" onClick={submit} disabled={!draft.trim()}>
        <Icon name="plus" size={14} /> დამატება
      </button>
    </div>
  );
};

/**
 * @param onChange  (updater) => void — updater({ options, variants }) აბრუნებს ახალ მდგომარეობას.
 *                  ფუნქციური განახლება: ზედიზედ სწრაფი მოქმედებები ერთმანეთს არ გადაწერს.
 */
const VariantEditor = ({ options, variants, onChange, onSale, basePrice }) => {
  const update = (fn) => onChange((s) => ({ ...s, ...fn(s) }));
  // ოფციები/ვარიანტები სტაბილური _id-ით — ინდექსი არ გამოიყენება (სწრაფი ცვლილებების დროს ინდექსი შეიძლება შეიცვალოს)
  const updateOption = (optionId, patch) =>
    update((s) => ({ options: s.options.map((o) => (o._id === optionId ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)) }));

  const addOption = () =>
    update((s) => ({ options: [...s.options, { _id: newId(), name: '', required: true, display: 'chip', values: [] }] }));

  const moveOption = (optionId, dir) =>
    update((s) => {
      const i = s.options.findIndex((o) => o._id === optionId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.options.length) return {};
      const next = [...s.options];
      [next[i], next[j]] = [next[j], next[i]];
      return { options: next };
    });

  // ოფციის წაშლა: მისი მნიშვნელობები ქრება ვარიანტებიდან; დუბლიკატი კომბინაციები ერთიანდება
  const removeOption = (optionId) =>
    update((s) => {
      const option = s.options.find((o) => o._id === optionId);
      if (!option) return {};
      const removed = new Set(option.values.map((v) => v._id));
      const nextOptions = s.options.filter((o) => o._id !== optionId);
      const seen = new Set();
      const nextVariants = nextOptions.length
        ? s.variants
            .map((v) => ({ ...v, values: v.values.filter((id) => !removed.has(id)) }))
            .filter((v) => {
              const key = comboKey(nextOptions, v);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
        : [];
      return { options: nextOptions, variants: nextVariants };
    });

  const addValues = (optionId, labels) =>
    updateOption(optionId, (o) => {
      const existing = new Set(o.values.map((v) => v.label.trim().toLocaleLowerCase()));
      const fresh = labels.filter((l) => !existing.has(l.toLocaleLowerCase())).map((label) => ({ _id: newId(), label, color: '' }));
      return { values: [...o.values, ...fresh] };
    });

  const updateValue = (optionId, value) => updateOption(optionId, (o) => ({ values: o.values.map((x) => (x._id === value._id ? value : x)) }));

  // მნიშვნელობის წაშლა: ვარიანტები, რომლებიც მას იყენებს, იშლება (ისტორიული შეკვეთები არ იცვლება — მათ snapshot აქვთ)
  const removeValue = (optionId, valueId) =>
    update((s) => ({
      options: s.options.map((o) => (o._id === optionId ? { ...o, values: o.values.filter((v) => v._id !== valueId) } : o)),
      variants: s.variants.filter((v) => !v.values.includes(valueId)),
    }));

  // ყველა კომბინაცია (არსებულები ინარჩუნებენ ფასს/მარაგს); არასავალდებულო ოფციებიც მონაწილეობს
  const generate = () =>
    update((s) => {
      const usable = s.options.filter((o) => o.values.length);
      if (!usable.length) return {};
      const combos = usable.reduce((acc, o) => acc.flatMap((c) => o.values.map((v) => [...c, v._id])), [[]]);
      const existing = new Set(s.variants.map((v) => comboKey(s.options, v)));
      const defaultPrice = s.variants[0]?.price ?? basePrice ?? '';
      const added = combos
        .map((values) => ({ _id: newId(), values, price: defaultPrice, oldPrice: '', stock: 0, sku: '', isActive: true }))
        .filter((v) => !existing.has(comboKey(s.options, v)));
      return { variants: [...s.variants, ...added].slice(0, MAX_VARIANTS) };
    });

  const addVariant = () =>
    update((s) => ({
      variants: [...s.variants, { _id: newId(), values: [], price: s.variants[0]?.price ?? basePrice ?? '', oldPrice: '', stock: 0, sku: '', isActive: true }],
    }));

  const updateVariant = (variantId, patch) =>
    update((s) => ({
      variants: s.variants.map((v) => (v._id === variantId ? { ...v, ...(typeof patch === 'function' ? patch(v) : patch) } : v)),
    }));
  const removeVariant = (variantId) => update((s) => ({ variants: s.variants.filter((v) => v._id !== variantId) }));
  const setVariantValue = (variantId, option, valueId) =>
    updateVariant(variantId, (v) => {
      const others = v.values.filter((id) => !option.values.some((x) => x._id === id));
      return { values: valueId ? [...others, valueId] : others };
    });

  const combosTotal = options.reduce((n, o) => n * Math.max(1, o.values.length), options.length ? 1 : 0);
  const prices = variants.filter((v) => v.isActive && v.price !== '').map((v) => Number(v.price));

  return (
    <div className="variant-editor">
      {/* ---- ოფციები */}
      <div className="ve-options">
        {options.map((o, i) => (
          <fieldset key={o._id} className="ve-option">
            <legend className="sr-only">ოფცია {i + 1}</legend>
            <div className="ve-option-head">
              <input
                className="input input-sm ve-option-name"
                value={o.name}
                placeholder="ოფციის სახელი, მაგ. მეხსიერება"
                onChange={(e) => updateOption(o._id, { name: e.target.value })}
                aria-label={`ოფცია ${i + 1} — სახელი`}
                maxLength={40}
              />
              <select
                className="select input-sm ve-display"
                value={o.display}
                onChange={(e) => updateOption(o._id, { display: e.target.value })}
                aria-label="ჩვენების ფორმა"
              >
                <option value="chip">ტექსტური ღილაკები</option>
                <option value="swatch">ფერის ნიმუშები</option>
              </select>
              <label className="checkbox ve-required">
                <input type="checkbox" checked={o.required} onChange={(e) => updateOption(o._id, { required: e.target.checked })} />
                <span>აუცილებელი არჩევა</span>
              </label>
              <div className="ve-option-tools">
                <button type="button" className="ve-icon" onClick={() => moveOption(o._id, -1)} disabled={i === 0} aria-label="ზემოთ" title="ზემოთ">
                  <Icon name="chevronLeft" size={14} className="rot-90" />
                </button>
                <button type="button" className="ve-icon" onClick={() => moveOption(o._id, 1)} disabled={i === options.length - 1} aria-label="ქვემოთ" title="ქვემოთ">
                  <Icon name="chevronDown" size={14} />
                </button>
                <button type="button" className="ve-icon danger" onClick={() => removeOption(o._id)} aria-label={`ოფციის „${o.name}" წაშლა`} title="ოფციის წაშლა">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
            <div className="ve-values">
              {o.values.map((v) => (
                <ValueChip
                  key={v._id}
                  option={o}
                  value={v}
                  onChange={(nv) => updateValue(o._id, nv)}
                  onRemove={() => removeValue(o._id, v._id)}
                />
              ))}
            </div>
            <AddValue onAdd={(labels) => addValues(o._id, labels)} placeholder="ახალი მნიშვნელობა (მაგ. 128 GB, 256 GB)" />
          </fieldset>
        ))}
        <button type="button" className="btn btn-sm ve-add-option" onClick={addOption} disabled={options.length >= 10}>
          <Icon name="plus" size={16} /> ოფციის დამატება
        </button>
      </div>

      {/* ---- ვარიანტები */}
      {options.length > 0 && (
        <div className="ve-variants">
          <div className="ve-variants-head">
            <div>
              <h3>ვარიანტები ({variants.length})</h3>
              <p className="muted">
                მიუთითეთ დასაშვები კომბინაციები, მათი ფასი და მარაგი. ყველა კომბინაცია არ არის სავალდებულო
                {combosTotal > 0 && ` (შესაძლებელია ${combosTotal})`}.
                {prices.length > 0 && ` ფასები: ${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}.`}
              </p>
            </div>
            <div className="ve-variant-actions">
              <button type="button" className="btn btn-sm" onClick={generate} disabled={!options.some((o) => o.values.length)}>
                <Icon name="layers" size={14} /> კომბინაციების გენერირება
              </button>
              <button type="button" className="btn btn-sm" onClick={addVariant}>
                <Icon name="plus" size={14} /> ვარიანტის დამატება
              </button>
            </div>
          </div>

          <div className="ve-variant-list">
            {variants.map((v, i) => (
              <div key={v._id} className={`ve-variant ${v.isActive ? '' : 'inactive'}`}>
                <div className="ve-variant-combo">
                  <span className="ve-variant-num">#{i + 1}</span>
                  {options.map((o) => {
                    const current = o.values.find((x) => v.values.includes(x._id));
                    return (
                      <label key={o._id} className="ve-field">
                        <span>{o.name || 'ოფცია'}</span>
                        <select
                          className="select input-sm"
                          value={current?._id || ''}
                          onChange={(e) => setVariantValue(v._id, o, e.target.value)}
                        >
                          <option value="">{o.required ? 'აირჩიეთ...' : '— არ აქვს —'}</option>
                          {o.values.map((x) => (
                            <option key={x._id} value={x._id}>
                              {x.label || '(ცარიელი)'}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
                <div className="ve-variant-fields">
                  <label className="ve-field">
                    <span>ფასი (₾)</span>
                    <input className="input input-sm" type="number" min="0" step="0.01" value={v.price} onChange={(e) => updateVariant(v._id, { price: e.target.value })} />
                  </label>
                  <label className="ve-field">
                    <span>ძველი ფასი (₾)</span>
                    <input
                      className="input input-sm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={v.oldPrice}
                      disabled={!onSale}
                      title={!onSale ? 'ჩართეთ „ფასდაკლებაშია"' : undefined}
                      onChange={(e) => updateVariant(v._id, { oldPrice: e.target.value })}
                    />
                  </label>
                  <label className="ve-field">
                    <span>მარაგი</span>
                    <input className="input input-sm" type="number" min="0" step="1" value={v.stock} onChange={(e) => updateVariant(v._id, { stock: e.target.value })} />
                  </label>
                  <label className="ve-field ve-sku">
                    <span>SKU</span>
                    <input className="input input-sm" value={v.sku} maxLength={64} onChange={(e) => updateVariant(v._id, { sku: e.target.value })} />
                  </label>
                  <label className="switch ve-active">
                    <input type="checkbox" checked={v.isActive} onChange={(e) => updateVariant(v._id, { isActive: e.target.checked })} />
                    <span className="track" />
                    აქტიური
                  </label>
                  <button
                    type="button"
                    className="ve-icon danger ve-remove"
                    onClick={() => removeVariant(v._id)}
                    aria-label={`ვარიანტი #${i + 1} — წაშლა`}
                    title="ვარიანტის წაშლა"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            ))}
            {!variants.length && <p className="muted ve-empty">ვარიანტები ჯერ არ არის. დააჭირეთ „კომბინაციების გენერირებას" ან დაამატეთ ხელით.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantEditor;
