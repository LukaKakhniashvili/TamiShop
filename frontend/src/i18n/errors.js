import i18n, { DEFAULT_LANGUAGE } from './index';

/*
 * სერვერის შეცდომის ტექსტი არჩეულ ენაზე.
 * სერვერი აბრუნებს სტაბილურ კოდს (code) + პარამეტრებს; ტექსტს UI თარგმნის: errors.codes.<CODE>.
 * კოდის გარეშე: ქართულად — სერვერის (ქართული) ტექსტი; სხვა ენაზე — თარგმნილი ზოგადი შეტყობინება
 * (fallbackKey), რომ მომხმარებელმა სხვა ენის ტექსტი არ ნახოს.
 */
export const apiErrorMessage = (err, fallbackKey = 'errors.generic') => {
  if (!err?.response) return i18n.t('errors.network');
  const data = err.response.data || {};
  // არასწორი კოდი ბოლო მცდელობაზე — ცალკე ტექსტი (ახალი კოდის მოთხოვნა)
  const code = data.code === 'CODE_INVALID' && data.attemptsLeft === 0 ? 'CODE_INVALID_LAST' : data.code;
  if (code && i18n.exists(`errors.codes.${code}`)) {
    return i18n.t(`errors.codes.${code}`, { ...data, message: undefined });
  }
  if (err.response.status === 429) return i18n.t('errors.codes.RATE_LIMITED', data);
  if (i18n.language === DEFAULT_LANGUAGE && data.message) return data.message;
  return i18n.t(fallbackKey);
};
