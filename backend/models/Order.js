const mongoose = require('mongoose');
const { DELIVERY_METHODS, PAYMENT_METHODS, PAYMENT_BANKS, PAYMENT_STATUSES } = require('../constants/checkout');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    // თავდაპირველი ფასი შეკვეთის მომენტში (ფასდაკლების ჩვენებისთვის)
    oldPrice: { type: Number, default: null },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // ადამიანისთვის წაკითხვადი ნომერი (მაგ. TM-260930-4K7Q); ძველ შეკვეთებს შეიძლება არ ჰქონდეთ
    orderNumber: { type: String, unique: true, sparse: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    // itemsTotal + delivery.cost (ძველ შეკვეთებში მხოლოდ ნივთების ჯამი)
    totalPrice: { type: Number, required: true },
    itemsTotal: { type: Number },

    customerInfo: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phone: { type: String, required: true },
      address: {
        city: { type: String, required: true },
        // დეტალური მისამართი: ქუჩა, სახლი, ბინა...
        street: { type: String, required: true },
        postalCode: { type: String, default: '' },
      },
    },

    delivery: {
      method: { type: String, enum: Object.keys(DELIVERY_METHODS) },
      cost: { type: Number, default: 0 },
      estimate: { type: String },
    },

    // ბარათის მონაცემებს მხოლოდ ბანკი იღებს. აქ ინახება მხოლოდ ბანკის სესიის ID,
    // ტრანზაქციის ID და (თუ ბანკი აბრუნებს) ბარათის ბრენდი/ბოლო 4 ციფრი.
    payment: {
      method: { type: String, enum: Object.keys(PAYMENT_METHODS) },
      status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
      provider: { type: String, enum: [...Object.keys(PAYMENT_BANKS), 'mock'] },
      mode: { type: String, enum: ['live', 'sandbox'] },
      sessionId: { type: String, index: true, sparse: true },
      transactionId: { type: String },
      cardBrand: { type: String },
      cardLast4: { type: String },
      paidAt: { type: Date },
      failureReason: { type: String },
      // გადახდა შესრულდა უკვე გაუქმებულ შეკვეთაზე (ძველი სესიით) — თანხა უნდა დაბრუნდეს
      refundRequired: { type: Boolean },
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'completed', 'cancelled'],
      default: 'pending',
    },

    // დადასტურების წერილის მდგომარეობა (წარუმატებლობა შეკვეთაზე გავლენას არ ახდენს)
    notifications: {
      confirmationEmailSentAt: { type: Date },
      confirmationEmailError: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
