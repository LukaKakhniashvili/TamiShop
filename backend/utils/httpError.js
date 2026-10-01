/**
 * HTTP შეცდომა სტატუსით და (არასავალდებულო) მანქანურად წასაკითხი დეტალებით.
 * errorHandler აბრუნებს: { message, ...details } — მაგ. { message, code: 'CODE_EXPIRED' }
 */
const httpError = (statusCode, message, details) => Object.assign(new Error(message), { statusCode, details });

module.exports = httpError;
