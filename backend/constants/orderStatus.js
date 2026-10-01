/*
 * შეკვეთის სტატუსის workflow — ერთადერთი წყარო (backend ამოწმებს, frontend იღებს API-დან `actions`-ით).
 *
 *   pending → processing → shipped → completed       (თანმიმდევრული, ნაბიჯის გამოტოვება/უკან დაბრუნება აკრძალულია)
 *   pending | processing | shipped → cancelled         (ცალკე მოქმედება; completed და cancelled — საბოლოო)
 */

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

// ნორმალური მიმდევრობის შემდეგი ნაბიჯი
const NEXT_STATUS = {
  pending: 'processing',
  processing: 'shipped',
  shipped: 'completed',
};

const CANCELLABLE_STATUSES = ['pending', 'processing', 'shipped'];

// „აქტიური" (ჯერ არ დასრულებული) შეკვეთები — შემოსავლის სტატისტიკაში ყვითელი
const IN_PROGRESS_STATUSES = ['pending', 'processing', 'shipped'];

const ORDER_STATUS_LABELS = {
  pending: 'მოლოდინში',
  processing: 'მუშავდება',
  shipped: 'გაგზავნილია',
  completed: 'დასრულებულია',
  cancelled: 'გაუქმებულია',
};

// ბარათით შეკვეთა რეალურია მხოლოდ გადახდის შემდეგ; გადაუხდელი მცდელობები workflow-ში არ მიდის
const isConfirmedOrder = (order) => order.payment?.method !== 'card' || order.payment?.status === 'paid';

/** შეკვეთაზე ადმინისთვის ხელმისაწვდომი მოქმედებები (frontend-ი მხოლოდ ამას აჩვენებს) */
const allowedActions = (order) => {
  const confirmed = isConfirmedOrder(order);
  return {
    next: confirmed ? NEXT_STATUS[order.status] || null : null,
    canCancel: CANCELLABLE_STATUSES.includes(order.status),
  };
};

/** MongoDB-ის პირობა „დადასტურებული შეკვეთისთვის" (სტატისტიკა) */
const CONFIRMED_ORDER_MATCH = { $or: [{ 'payment.method': { $ne: 'card' } }, { 'payment.status': 'paid' }] };

module.exports = {
  ORDER_STATUSES,
  NEXT_STATUS,
  CANCELLABLE_STATUSES,
  IN_PROGRESS_STATUSES,
  ORDER_STATUS_LABELS,
  isConfirmedOrder,
  allowedActions,
  CONFIRMED_ORDER_MATCH,
};
