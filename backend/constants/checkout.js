// შეკვეთის გაფორმების კონფიგურაცია — ერთადერთი წყარო.
// ფრონტენდი ამას იღებს GET /api/orders/checkout-options-დან, სერვერი კი ვალიდაციისთვის იყენებს.

// საქართველოს ქალაქები (latin — ლათინური ასოებით ძიებისთვის). პირველი — ყველაზე მოთხოვნადი.
const GEORGIAN_CITIES = [
  ['თბილისი', 'Tbilisi'],
  ['ბათუმი', 'Batumi'],
  ['ქუთაისი', 'Kutaisi'],
  ['რუსთავი', 'Rustavi'],
  ['გორი', 'Gori'],
  ['ზუგდიდი', 'Zugdidi'],
  ['ფოთი', 'Poti'],
  ['თელავი', 'Telavi'],
  ['ქობულეთი', 'Kobuleti'],
  ['ხაშური', 'Khashuri'],
  ['სამტრედია', 'Samtredia'],
  ['სენაკი', 'Senaki'],
  ['ზესტაფონი', 'Zestaponi'],
  ['მარნეული', 'Marneuli'],
  ['ახალციხე', 'Akhaltsikhe'],
  ['ოზურგეთი', 'Ozurgeti'],
  ['კასპი', 'Kaspi'],
  ['ჭიათურა', 'Chiatura'],
  ['წყალტუბო', 'Tskaltubo'],
  ['საგარეჯო', 'Sagarejo'],
  ['გარდაბანი', 'Gardabani'],
  ['ბორჯომი', 'Borjomi'],
  ['ტყიბული', 'Tkibuli'],
  ['ხონი', 'Khoni'],
  ['ბოლნისი', 'Bolnisi'],
  ['ახალქალაქი', 'Akhalkalaki'],
  ['გურჯაანი', 'Gurjaani'],
  ['მცხეთა', 'Mtskheta'],
  ['ყვარელი', 'Kvareli'],
  ['ახმეტა', 'Akhmeta'],
  ['ქარელი', 'Kareli'],
  ['ლანჩხუთი', 'Lanchkhuti'],
  ['წალენჯიხა', 'Tsalenjikha'],
  ['დუშეთი', 'Dusheti'],
  ['საჩხერე', 'Sachkhere'],
  ['დედოფლისწყარო', 'Dedoplistskaro'],
  ['ლაგოდეხი', 'Lagodekhi'],
  ['ნინოწმინდა', 'Ninotsminda'],
  ['აბაშა', 'Abasha'],
  ['წნორი', 'Tsnori'],
  ['თერჯოლა', 'Terjola'],
  ['მარტვილი', 'Martvili'],
  ['ხობი', 'Khobi'],
  ['წალკა', 'Tsalka'],
  ['ვანი', 'Vani'],
  ['ბაღდათი', 'Baghdati'],
  ['ვალე', 'Vale'],
  ['თეთრიწყარო', 'Tetritskaro'],
  ['დმანისი', 'Dmanisi'],
  ['ონი', 'Oni'],
  ['ამბროლაური', 'Ambrolauri'],
  ['სიღნაღი', 'Sighnaghi'],
  ['ცაგერი', 'Tsageri'],
  ['ჯვარი', 'Jvari'],
  ['ხულო', 'Khulo'],
  ['მესტია', 'Mestia'],
  ['თიანეთი', 'Tianeti'],
  ['სტეფანწმინდა', 'Stepantsminda'],
  ['ადიგენი', 'Adigeni'],
  ['ასპინძა', 'Aspindza'],
  ['ჩოხატაური', 'Chokhatauri'],
  ['ქედა', 'Keda'],
  ['შუახევი', 'Shuakhevi'],
  ['ხარაგაული', 'Kharagauli'],
  ['ლენტეხი', 'Lentekhi'],
].map(([name, latin]) => ({ name, latin }));

const CITY_NAMES = new Set(GEORGIAN_CITIES.map((c) => c.name));

// მიწოდების ვარიანტები. ღირებულება ყოველთვის სერვერიდან აიღება — შეკვეთის ჯამს არ ემატება.
const DELIVERY_METHODS = {
  standard: {
    id: 'standard',
    label: 'სტანდარტული მიწოდება',
    cost: 0,
    minDays: 2,
    maxDays: 6,
    estimate: '2–6 სამუშაო დღე',
    coverage: 'საქართველოს ყველა რეგიონი',
  },
};
const DEFAULT_DELIVERY_METHOD = 'standard';

const PAYMENT_METHODS = {
  card: { id: 'card', label: 'ბარათით გადახდა', description: 'ბანკის დაცულ გვერდზე — Visa, Mastercard' },
  cod: { id: 'cod', label: 'კურიერთან გადახდა', description: 'გადაიხდით შეკვეთის მიღებისას' },
};

// ბარათით გადახდა დროებით გამორთულია, სანამ ბანკების ინტეგრაცია არ დასრულდება.
// ჩასართავად: CARD_PAYMENTS_ENABLED=true (.env). კოდი (ბანკები, მოდალი, callback-ები) უცვლელია.
const isPaymentMethodEnabled = (id) => (id === 'card' ? process.env.CARD_PAYMENTS_ENABLED === 'true' : Boolean(PAYMENT_METHODS[id]));

// ბანკები ბარათით გადახდისთვის. ბარათის მონაცემებს მხოლოდ ბანკის გვერდი იღებს.
const PAYMENT_BANKS = {
  BOG: { id: 'BOG', name: 'საქართველოს ბანკი', latin: 'Bank of Georgia', short: 'BOG' },
  TBC: { id: 'TBC', name: 'თიბისი ბანკი', latin: 'TBC Bank', short: 'TBC' },
};

// payment.status მნიშვნელობები
const PAYMENT_STATUSES = ['pending', 'paid', 'pay_on_delivery', 'failed', 'cancelled', 'refunded'];

module.exports = {
  GEORGIAN_CITIES,
  CITY_NAMES,
  DELIVERY_METHODS,
  DEFAULT_DELIVERY_METHOD,
  PAYMENT_METHODS,
  isPaymentMethodEnabled,
  PAYMENT_BANKS,
  PAYMENT_STATUSES,
};
