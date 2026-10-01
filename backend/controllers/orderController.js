const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Product = require('../models/Product');
const {
  GEORGIAN_CITIES,
  CITY_NAMES,
  DELIVERY_METHODS,
  DEFAULT_DELIVERY_METHOD,
  PAYMENT_METHODS,
  isPaymentMethodEnabled,
  PAYMENT_BANKS,
} = require('../constants/checkout');
const { getProviderMode } = require('../services/payments');
const { applyConfirmedOrderEffects, cancelUnpaidOrder } = require('../services/orderPayments');

const round2 = (n) => Math.round(n * 100) / 100;

// TM-YYMMDD-XXXX; უნიკალურობას ინდექსი იცავს, კოლიზიისას ვცდით თავიდან
const generateOrderNumber = () => {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `TM-${date}-${rand}`;
};

// @desc    შეკვეთის გაფორმების პარამეტრები: ქალაქები, მიწოდება, გადახდის მეთოდები, ბანკები
// @route   GET /api/orders/checkout-options
// @access  Public
const getCheckoutOptions = (req, res) => {
  res.json({
    cities: GEORGIAN_CITIES,
    deliveryMethods: Object.values(DELIVERY_METHODS),
    defaultDeliveryMethod: DEFAULT_DELIVERY_METHOD,
    // enabled: false — მეთოდი ჩანს, მაგრამ დროებით მიუწვდომელია (იხ. isPaymentMethodEnabled)
    paymentMethods: Object.values(PAYMENT_METHODS).map((m) => ({ ...m, enabled: isPaymentMethodEnabled(m.id) })),
    // mode: 'live' | 'sandbox' | null (null — ბანკი ამ გარემოში მიუწვდომელია)
    banks: Object.values(PAYMENT_BANKS).map((b) => ({ ...b, mode: getProviderMode(b.id) })),
  });
};

// ველების ვალიდაცია; აბრუნებს { field: message } ობიექტს
const validateCheckout = ({ items, customerInfo = {}, deliveryMethod, paymentMethod, bank }) => {
  const errors = {};
  const addr = customerInfo.address || {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  if (!Array.isArray(items) || items.length === 0) errors.items = 'კალათა ცარიელია';
  else if (items.some((i) => !i?.productId || !Number.isInteger(i.quantity) || i.quantity < 1)) {
    errors.items = 'კალათის მონაცემები არასწორია';
  }
  if (!text(customerInfo.firstName)) errors.firstName = 'შეიყვანეთ სახელი';
  if (!text(customerInfo.lastName)) errors.lastName = 'შეიყვანეთ გვარი';
  if (!/^[+\d][\d\s-]{7,}$/.test(text(customerInfo.phone))) errors.phone = 'შეიყვანეთ სწორი ტელეფონის ნომერი';
  if (!CITY_NAMES.has(text(addr.city))) errors.city = 'აირჩიეთ ქალაქი სიიდან';
  if (text(addr.street).length < 5) errors.street = 'მიუთითეთ სრული მისამართი (ქუჩა, სახლი, ბინა)';
  if (!DELIVERY_METHODS[deliveryMethod]) errors.deliveryMethod = 'აირჩიეთ მიწოდების მეთოდი';
  if (!PAYMENT_METHODS[paymentMethod]) errors.paymentMethod = 'აირჩიეთ გადახდის მეთოდი';
  else if (!isPaymentMethodEnabled(paymentMethod)) errors.paymentMethod = 'ეს გადახდის მეთოდი დროებით მიუწვდომელია';
  else if (paymentMethod === 'card') {
    if (!PAYMENT_BANKS[bank]) errors.bank = 'აირჩიეთ ბანკი';
    else if (!getProviderMode(bank)) errors.bank = 'არჩეული ბანკით გადახდა დროებით მიუწვდომელია';
  }
  return errors;
};

// @desc    შეკვეთის შექმნა (checkout): მიწოდება + გადახდა (ბარათი ან კურიერთან)
// @route   POST /api/orders
// @access  Private
// body: { items: [{ productId, quantity }], customerInfo: { firstName, lastName, phone, address: { city, street, postalCode } },
//         deliveryMethod: 'standard', paymentMethod: 'card' | 'cod', bank?: 'BOG' | 'TBC' }
// ბარათით: იქმნება მოლოდინში მყოფი შეკვეთა; გადახდა — POST /api/payments/:orderId/init
const createOrder = asyncHandler(async (req, res) => {
  const { items, customerInfo, paymentMethod, bank } = req.body;
  const deliveryMethod = req.body.deliveryMethod || DEFAULT_DELIVERY_METHOD;

  const errors = validateCheckout({ items, customerInfo, deliveryMethod, paymentMethod, bank });
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: Object.values(errors)[0], fields: errors });
  }

  // ფასების გადამოწმება ბაზიდან (არასდროს ვენდობით frontend-ის ფასს)
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  let itemsTotal = 0;
  const orderItems = items.map((item) => {
    const product = products.find((p) => p._id.toString() === item.productId);
    if (!product || !product.isActive) {
      res.status(404);
      throw new Error(`პროდუქტი აღარ არის ხელმისაწვდომი${product ? `: ${product.name}` : ''}`);
    }
    if (!product.inStock || product.stock < item.quantity) {
      res.status(400);
      throw new Error(`არასაკმარისი მარაგი პროდუქტისთვის: ${product.name}`);
    }
    itemsTotal += product.price * item.quantity;
    return {
      product: product._id,
      name: product.name,
      price: product.price,
      oldPrice: product.onSale && product.oldPrice > product.price ? product.oldPrice : null,
      quantity: item.quantity,
    };
  });

  const delivery = DELIVERY_METHODS[deliveryMethod];
  itemsTotal = round2(itemsTotal);
  const totalPrice = round2(itemsTotal + delivery.cost);
  const address = customerInfo.address;

  const orderData = {
    user: req.user._id,
    items: orderItems,
    itemsTotal,
    totalPrice,
    customerInfo: {
      firstName: customerInfo.firstName.trim(),
      lastName: customerInfo.lastName.trim(),
      phone: customerInfo.phone.trim(),
      address: { city: address.city.trim(), street: address.street.trim(), postalCode: (address.postalCode || '').trim() },
    },
    delivery: { method: delivery.id, cost: delivery.cost, estimate: delivery.estimate },
    payment: {
      method: paymentMethod,
      // კურიერთან გადახდა — მიტანისას; ბარათი — მოლოდინში, სანამ ბანკი არ დაადასტურებს
      status: paymentMethod === 'cod' ? 'pay_on_delivery' : 'pending',
      ...(paymentMethod === 'card' ? { provider: bank } : {}),
    },
  };

  let order;
  for (let attempt = 0; !order; attempt++) {
    try {
      order = await Order.create({ ...orderData, orderNumber: generateOrderNumber() });
    } catch (err) {
      if (err.code !== 11000 || attempt >= 4) throw err;
    }
  }

  // ბარათით: შეკვეთა რჩება მოლოდინში. გადახდის სესია იქმნება POST /api/payments/:orderId/init-ით,
  // მარაგი და მომხმარებლის მონაცემები კი ახლდება მხოლოდ ბანკის დადასტურების შემდეგ.
  if (paymentMethod === 'cod') {
    await applyConfirmedOrderEffects(order);
  }

  res.status(201).json(order);
});

// @desc    გადაუხდელი (checkout-ის დროს შექმნილი) ბარათის შეკვეთის გაუქმება მომხმარებლის მიერ.
//          გადახდილი ან უკვე დადასტურებული შეკვეთის გაუქმება აქედან შეუძლებელია.
// @route   POST /api/orders/:id/cancel   body: { reason?: 'cart_changed' | 'customer_cancelled' }
// @access  Private (მხოლოდ მფლობელი)
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order || String(order.user) !== String(req.user._id)) {
    res.status(404);
    throw new Error('შეკვეთა ვერ მოიძებნა');
  }
  if (order.payment?.method !== 'card') {
    res.status(409);
    throw new Error('ეს შეკვეთა უკვე დადასტურებულია და აქედან ვერ გაუქმდება');
  }
  if (order.status === 'cancelled') return res.json({ cancelled: true, order });

  const reason = req.body?.reason === 'cart_changed' ? 'კალათა შეიცვალა — შეიქმნა ახალი შეკვეთა' : 'მომხმარებელმა გააუქმა';
  const result = await cancelUnpaidOrder(order, reason);
  if (result.alreadyPaid) {
    return res.status(409).json({ message: 'შეკვეთა უკვე გადახდილია', status: 'paid', order: result.order });
  }
  res.json({ cancelled: true, order: result.order });
});

// @desc    ჩემი შეკვეთების სია — მხოლოდ დადასტურებული (ბარათით გადაუხდელი მცდელობების გარეშე)
// @route   GET /api/orders/mine
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
    $or: [{ 'payment.method': { $ne: 'card' } }, { 'payment.status': 'paid' }],
  }).sort('-createdAt');
  res.json(orders);
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ადმინის ფილტრები -> MongoDB query. ყველა ფილტრი ერთად მუშაობს (AND).
const buildAdminOrderFilter = (q) => {
  const filter = {};
  const and = [];

  // შეკვეთის ნომერი: "TM-261001-89A95", "tm 261001 89a95", "89A95" ან ძველი ფორმატი "#A1B2C3" (ID-ის ბოლო 6 სიმბოლო)
  const raw = String(q.orderNumber || '').trim().toUpperCase().replace(/^#/, '');
  if (raw) {
    const normalized = raw.replace(/[\s_]+/g, '-');
    const or = [{ orderNumber: { $regex: escapeRegex(normalized), $options: 'i' } }];
    if (/^[0-9A-F]{4,24}$/.test(raw)) {
      or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${raw.toLowerCase()}$` } } });
    }
    and.push({ $or: or });
  }
  if (q.phone) filter['customerInfo.phone'] = { $regex: escapeRegex(String(q.phone).trim()) };
  if (q.status) filter.status = String(q.status);
  if (q.minPrice || q.maxPrice) {
    filter.totalPrice = {};
    if (q.minPrice !== undefined && q.minPrice !== '') filter.totalPrice.$gte = Number(q.minPrice);
    if (q.maxPrice !== undefined && q.maxPrice !== '') filter.totalPrice.$lte = Number(q.maxPrice);
  }
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(`${q.from}T00:00:00.000+04:00`);
    if (q.to) filter.createdAt.$lte = new Date(`${q.to}T23:59:59.999+04:00`);
  }
  if (and.length) filter.$and = and;
  return filter;
};

// @desc    შეკვეთების სია (ადმინი) — ფილტრაცია და გვერდები სერვერზე
// @route   GET /api/orders?orderNumber=&phone=&status=&minPrice=&maxPrice=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20
// @access  Private/Admin
// პასუხი: { orders, total, page, pages, stats: { total, pending, revenue } }
const getOrders = asyncHandler(async (req, res) => {
  const filter = buildAdminOrderFilter(req.query);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const page = Math.max(1, Number(req.query.page) || 1);

  const [orders, total, statsAgg] = await Promise.all([
    Order.find(filter)
      .populate('user', 'firstName lastName email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
    // ზოგადი სტატისტიკა (ფილტრის გარეშე). შემოსავალში არ ითვლება გაუქმებული და ბარათით გადაუხდელი შეკვეთები.
    Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'cancelled'] },
                    { $or: [{ $ne: ['$payment.method', 'card'] }, { $eq: ['$payment.status', 'paid'] }] },
                  ],
                },
                '$totalPrice',
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const { total: allTotal = 0, pending = 0, revenue = 0 } = statsAgg[0] || {};
  res.json({ orders, total, page, pages: Math.max(1, Math.ceil(total / limit)), stats: { total: allTotal, pending, revenue } });
});

// @desc    შეკვეთის სტატუსის განახლება
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('შეკვეთა ვერ მოიძებნა');
  }
  order.status = req.body.status || order.status;
  // კურიერთან გადახდა ითვლება გადახდილად, როცა შეკვეთა ჩაბარდა
  if (order.status === 'completed' && order.payment?.method === 'cod' && order.payment.status === 'pay_on_delivery') {
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
  }
  const updated = await order.save();
  res.json(updated);
});

module.exports = { getCheckoutOptions, createOrder, cancelMyOrder, getMyOrders, getOrders, updateOrderStatus };
