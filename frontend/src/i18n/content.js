import { useTranslation } from 'react-i18next';
import i18n, { DEFAULT_LANGUAGE, currentLocale } from './index';

/*
 * დინამიკური (ბაზაში შენახული) კონტენტის თარგმანი.
 * საბაზისო ველები (name, description...) — ქართულად (ძირითადი ენა). თარგმანები არასავალდებულოა:
 *   product.translations  = { en: { name, description, specifications: [{ key, value }] }, ru: {...} }
 *   category.translations = { en: { name }, ru: { name } }
 *   option.translations   = { en: { name }, ru: { name } };  value.translations = { en: { label }, ru: { label } }
 * Fallback: არჩეული ენა → ქართული (საბაზისო ველი). მანქანური თარგმანი არ ხდება.
 */

export const localizedField = (entity, field, lng = i18n.language) => {
  if (!entity) return '';
  if (lng !== DEFAULT_LANGUAGE) {
    const v = entity.translations?.[lng]?.[field];
    if (typeof v === 'string' ? v.trim() : Array.isArray(v) && v.length) return v;
  }
  return entity[field];
};

/** პროდუქტის მახასიათებლები: თარგმნილი მწკრივი იმავე ინდექსზე, თუ შევსებულია — თორემ ქართული */
export const localizedSpecs = (product, lng = i18n.language) => {
  const base = product?.specifications || [];
  const tr = lng !== DEFAULT_LANGUAGE ? product?.translations?.[lng]?.specifications || [] : [];
  return base.map((s, i) => ({ key: tr[i]?.key?.trim() || s.key, value: tr[i]?.value?.trim() || s.value }));
};

/** React hook: L(entity, 'name') — ხელახლა რენდერდება ენის შეცვლისას */
export const useLocalized = () => {
  const { i18n: inst } = useTranslation();
  return (entity, field) => localizedField(entity, field, inst.language);
};

// ---- ფორმატირება (ლოკალის მიხედვით)
export const formatDate = (value, options = { year: 'numeric', month: 'long', day: 'numeric' }) =>
  new Date(value).toLocaleDateString(currentLocale(), options);
export const formatDateTime = (value) =>
  new Date(value).toLocaleString(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' });
