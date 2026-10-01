/*
 * პაროლის ერთიანი პოლიტიკა — გამოიყენება რეგისტრაციაში, პაროლის შეცვლაში, აღდგენაში და ადმინის მიერ
 * მომხმარებლის შექმნისას. ფრონტენდზე იგივე წესებია: frontend/src/utils/passwordPolicy.js
 */

const PASSWORD_MIN_LENGTH = 8;
// bcrypt იყენებს მხოლოდ პირველ 72 ბაიტს — უფრო გრძელი პაროლის ბოლო ნაწილი უგულებელყოფილი იქნებოდა
const PASSWORD_MAX_LENGTH = 64;

const PASSWORD_RULES = [
  { id: 'length', test: (p) => p.length >= PASSWORD_MIN_LENGTH, label: `მინ. ${PASSWORD_MIN_LENGTH} სიმბოლო` },
  { id: 'upper', test: (p) => /[A-Z]/.test(p), label: 'დიდი ლათინური ასო' },
  { id: 'lower', test: (p) => /[a-z]/.test(p), label: 'პატარა ლათინური ასო' },
  { id: 'digit', test: (p) => /\d/.test(p), label: 'ციფრი' },
  { id: 'special', test: (p) => /[^\p{L}\p{N}\s]/u.test(p), label: 'სპეციალური სიმბოლო (!@#$...)' },
];

const PASSWORD_POLICY_MESSAGE =
  `პაროლი უნდა შეიცავდეს მინიმუმ ${PASSWORD_MIN_LENGTH} სიმბოლოს, დიდ და პატარა ლათინურ ასოს, ციფრს და სპეციალურ სიმბოლოს`;

/** აბრუნებს შეცდომის ტექსტს ან null-ს, თუ პაროლი აკმაყოფილებს პოლიტიკას */
const validatePassword = (password) => {
  if (typeof password !== 'string' || !password) return 'პაროლი სავალდებულოა';
  if (password.length > PASSWORD_MAX_LENGTH) return `პაროლი არ უნდა აღემატებოდეს ${PASSWORD_MAX_LENGTH} სიმბოლოს`;
  return PASSWORD_RULES.every((r) => r.test(password)) ? null : PASSWORD_POLICY_MESSAGE;
};

module.exports = { PASSWORD_RULES, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_POLICY_MESSAGE, validatePassword };
