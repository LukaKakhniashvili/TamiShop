import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ka from '../locales/ka.json';
import en from '../locales/en.json';
import ru from '../locales/ru.json';

/*
 * მრავალენოვნება (i18next + react-i18next).
 *   ka — ძირითადი, ნაგულისხმევი და სარეზერვო ენა. ბრაუზერის ენა ავტომატურად არ გამოიყენება.
 *   თარგმანები: src/locales/{ka,en,ru}.json — კომპონენტებში მხოლოდ t() გასაღებით (section.key).
 *   არჩეული ენა ინახება localStorage-ში ('lang'); <html lang> განახლდება ავტომატურად.
 * დინამიკური მონაცემები (პროდუქტი, კატეგორია, ოფციები): src/i18n/content.js
 */

export const DEFAULT_LANGUAGE = 'ka';
export const LANGUAGES = [
  { code: 'ka', label: 'ქართული', short: 'KA', locale: 'ka-GE' },
  { code: 'en', label: 'English', short: 'EN', locale: 'en-US' },
  { code: 'ru', label: 'Русский', short: 'RU', locale: 'ru-RU' },
];
const SUPPORTED = LANGUAGES.map((l) => l.code);
const STORAGE_KEY = 'lang';

const readSaved = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(v) ? v : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

i18n.use(initReactI18next).init({
  resources: { ka: { translation: ka }, en: { translation: en }, ru: { translation: ru } },
  lng: readSaved(),
  fallbackLng: DEFAULT_LANGUAGE, // არჩეული ენა → ქართული
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false }, // React თავად ახდენს escape-ს
  returnNull: false,
  returnEmptyString: false,
  // დეველოპმენტში გამოტოვებული თარგმანი ჩანს კონსოლში
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lngs, ns, key) => {
    if (import.meta.env.DEV) console.warn(`[i18n] missing translation: "${key}" (${lngs.join(', ')})`);
  },
  // ბოლო დაცვა: ნედლი გასაღები (checkout.confirm...) მომხმარებელს არასდროს უჩანს
  // (defaultValue — თუ გადაცემულია, მაგ. სერვერის ტექსტი)
  parseMissingKeyHandler: (key, defaultValue) => defaultValue ?? '',
  react: { useSuspense: false },
});

const applyDocumentLanguage = (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* private mode — ენა მხოლოდ ამ სესიაში დარჩება */
  }
};
applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', applyDocumentLanguage);

export const currentLocale = () => LANGUAGES.find((l) => l.code === i18n.language)?.locale || 'ka-GE';

export default i18n;
