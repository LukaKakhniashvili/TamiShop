// ბრენდის სახელი — ერთადერთი წყარო frontend-ისთვის. "Tam" და "i"-ს შორის არის backtick (`, U+0060).
// (ბრაუზერის სათაური და მეტა-ტეგები: index.html; ელ. წერილები: backend/constants/brand.js)
export const BRAND = { name: 'Tam`i Shop', main: 'Tam`i', accent: 'Shop' };

// "ცხელი შეთავაზებების" მინიმალური ფასდაკლება (%) — ფილტრაცია სერვერზე ხდება (?minDiscount=)
export const DEAL_MIN_DISCOUNT = 40;

export const orderStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

export const statusLabels = {
  pending: 'მოლოდინში',
  processing: 'მუშავდება',
  shipped: 'გაგზავნილია',
  completed: 'დასრულებულია',
  cancelled: 'გაუქმებულია',
};

// ადმინის „შემდეგი ნაბიჯის" ღილაკის ტექსტი. რომელი ნაბიჯია დასაშვები — წყვეტს სერვერი
// (backend/constants/orderStatus.js → order.actions.next); აქ მხოლოდ წარწერებია.
export const nextStatusActionLabels = {
  processing: 'დამუშავებაში გადატანა',
  shipped: 'გაგზავნილად მონიშვნა',
  completed: 'დასრულებულად მონიშვნა',
};

export const paymentMethodLabels = {
  card: 'ბარათით',
  cod: 'კურიერთან',
};

export const paymentStatusLabels = {
  pending: 'მოლოდინში',
  paid: 'გადახდილია',
  pay_on_delivery: 'გადახდა მიტანისას',
  failed: 'წარუმატებელი',
  cancelled: 'გაუქმებული',
  refunded: 'დაბრუნებულია',
};

export const paymentStatusPill = {
  pending: 'pill-warning',
  paid: 'pill-success',
  pay_on_delivery: 'pill-info',
  failed: 'pill-danger',
  cancelled: 'pill-neutral',
  refunded: 'pill-neutral',
};

export const statusPill = {
  pending: 'pill-warning',
  processing: 'pill-info',
  shipped: 'pill-accent',
  completed: 'pill-success',
  cancelled: 'pill-danger',
};
