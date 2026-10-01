/*
 * პაროლის ერთიანი პოლიტიკა — რეგისტრაცია, პაროლის შეცვლა, აღდგენა.
 * იგივე წესებია სერვერზე (backend/utils/passwordPolicy.js), რომელიც საბოლოო შემოწმებას აკეთებს.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_RULES = [
  { id: 'length', test: (p) => p.length >= PASSWORD_MIN_LENGTH, label: `მინ. ${PASSWORD_MIN_LENGTH} სიმბოლო` },
  { id: 'upper', test: (p) => /[A-Z]/.test(p), label: 'დიდი ლათინური ასო' },
  { id: 'lower', test: (p) => /[a-z]/.test(p), label: 'პატარა ლათინური ასო' },
  { id: 'digit', test: (p) => /\d/.test(p), label: 'ციფრი' },
  { id: 'special', test: (p) => /[^\p{L}\p{N}\s]/u.test(p), label: 'სპეციალური სიმბოლო (!@#$...)' },
];

export const PASSWORD_POLICY_MESSAGE =
  `პაროლი უნდა შეიცავდეს მინიმუმ ${PASSWORD_MIN_LENGTH} სიმბოლოს, დიდ და პატარა ლათინურ ასოს, ციფრს და სპეციალურ სიმბოლოს`;

export const PASSWORDS_MISMATCH_MESSAGE = 'პაროლები არ ემთხვევა.';

/** აბრუნებს შეცდომის ტექსტს ან null-ს */
export const validatePassword = (password) => {
  if (!password) return 'პაროლი სავალდებულოა';
  if (password.length > PASSWORD_MAX_LENGTH) return `პაროლი არ უნდა აღემატებოდეს ${PASSWORD_MAX_LENGTH} სიმბოლოს`;
  return PASSWORD_RULES.every((r) => r.test(password)) ? null : PASSWORD_POLICY_MESSAGE;
};

/** სიძლიერის მაჩვენებელი (0–3) ინდიკატორისთვის */
export const passwordScore = (password) => {
  if (!password) return 0;
  const met = PASSWORD_RULES.filter((r) => r.test(password)).length;
  return met === PASSWORD_RULES.length ? 3 : met >= PASSWORD_RULES.length - 1 ? 2 : 1;
};
