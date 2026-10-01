import i18n from '../i18n';

/*
 * პაროლის ერთიანი პოლიტიკა — რეგისტრაცია, პაროლის შეცვლა, აღდგენა.
 * იგივე წესებია სერვერზე (backend/utils/passwordPolicy.js), რომელიც საბოლოო შემოწმებას აკეთებს.
 * ტექსტები — თარგმანებიდან (password.*), არჩეულ ენაზე.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_RULES = [
  { id: 'length', test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', test: (p) => /\d/.test(p) },
  { id: 'special', test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

/** წესის წარწერა არჩეულ ენაზე */
export const ruleLabel = (rule, t = i18n.t.bind(i18n)) => t(`password.rules.${rule.id}`, { min: PASSWORD_MIN_LENGTH });

export const passwordPolicyMessage = () => i18n.t('password.policy', { min: PASSWORD_MIN_LENGTH });

export const passwordsMismatchMessage = () => i18n.t('password.mismatch');

/** აბრუნებს შეცდომის ტექსტს (არჩეულ ენაზე) ან null-ს */
export const validatePassword = (password) => {
  if (!password) return i18n.t('password.required');
  if (password.length > PASSWORD_MAX_LENGTH) return i18n.t('password.tooLong', { max: PASSWORD_MAX_LENGTH });
  return PASSWORD_RULES.every((r) => r.test(password)) ? null : passwordPolicyMessage();
};

/** სიძლიერის მაჩვენებელი (0–3) ინდიკატორისთვის */
export const passwordScore = (password) => {
  if (!password) return 0;
  const met = PASSWORD_RULES.filter((r) => r.test(password)).length;
  return met === PASSWORD_RULES.length ? 3 : met >= PASSWORD_RULES.length - 1 ? 2 : 1;
};
