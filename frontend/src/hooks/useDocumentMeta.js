import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND } from '../constants';

const setMeta = (selector, attr, value) => {
  const el = document.querySelector(selector);
  if (el && value) el.setAttribute(attr, value);
};

/**
 * გვერდის სათაური და აღწერა არჩეულ ენაზე (title, meta description, og:*).
 * ახლდება ენის შეცვლისას. ცარიელი title → მხოლოდ ბრენდი.
 */
const useDocumentMeta = (title, description) => {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    const full = title ? `${title} — ${BRAND.name}` : BRAND.name;
    const desc = description || t('meta.homeDescription');
    document.title = full;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', full);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:locale"]', 'content', { ka: 'ka_GE', en: 'en_US', ru: 'ru_RU' }[i18n.language]);
  }, [title, description, i18n.language, t]);
};

export default useDocumentMeta;
