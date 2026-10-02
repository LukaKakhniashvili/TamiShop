const ExcelJS = require('exceljs');
const Order = require('../models/Order');
const httpError = require('../utils/httpError');
const { cancelUnpaidOrder } = require('./orderPayments');
const { releaseStock, orderStockLines } = require('./productVariants');
const { orderStatusChanged } = require('./notifications/orderEvents');
const { DELIVERY_METHODS, PAYMENT_METHODS } = require('../constants/checkout');
const {
  NEXT_STATUS,
  CANCELLABLE_STATUSES,
  IN_PROGRESS_STATUSES,
  ORDER_STATUS_LABELS,
  isConfirmedOrder,
  CONFIRMED_ORDER_MATCH,
} = require('../constants/orderStatus');

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// ---------------------------------------------------------------------------
// სტატუსის workflow
// ---------------------------------------------------------------------------

/**
 * შემდეგ ნაბიჯზე გადაყვანა (pending → processing → shipped → completed).
 * ატომურია: თუ სტატუსი სხვა ადმინმა უკვე შეცვალა, მოთხოვნა უარყოფილია და ნაბიჯი ორჯერ არ შესრულდება.
 */
const advanceOrderStatus = async (orderId, requestedStatus, actorId) => {
  const order = await Order.findById(orderId);
  if (!order) throw httpError(404, 'შეკვეთა ვერ მოიძებნა');

  if (requestedStatus === 'cancelled') {
    throw httpError(400, 'შეკვეთის გასაუქმებლად გამოიყენეთ „შეკვეთის გაუქმება".', { code: 'USE_CANCEL_ACTION' });
  }
  const expected = NEXT_STATUS[order.status];
  if (!expected) {
    throw httpError(409, `შეკვეთა უკვე საბოლოო სტატუსშია (${ORDER_STATUS_LABELS[order.status]}).`, { code: 'FINAL_STATUS' });
  }
  if (requestedStatus !== expected) {
    throw httpError(
      400,
      `დაუშვებელი გადასვლა: ${ORDER_STATUS_LABELS[order.status] || order.status} → ${ORDER_STATUS_LABELS[requestedStatus] || requestedStatus}. ` +
        `შემდეგი ნაბიჯია: ${ORDER_STATUS_LABELS[expected]}.`,
      { code: 'INVALID_TRANSITION', currentStatus: order.status, allowedNext: expected }
    );
  }
  if (!isConfirmedOrder(order)) {
    throw httpError(409, 'ბარათით გადახდა არ დასრულებულა — შეკვეთის დამუშავება შეუძლებელია.', { code: 'NOT_PAID' });
  }

  const set = { status: expected };
  // კურიერთან გადახდა ითვლება გადახდილად, როცა შეკვეთა ჩაბარდა
  if (expected === 'completed' && order.payment?.method === 'cod' && order.payment.status === 'pay_on_delivery') {
    set['payment.status'] = 'paid';
    set['payment.paidAt'] = new Date();
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: { from: order.status, to: expected, at: new Date(), by: actorId } } },
    { new: true }
  );
  if (!updated) throw httpError(409, 'შეკვეთის სტატუსი უკვე შეიცვალა. განაახლეთ სია.', { code: 'STATUS_CHANGED' });
  // შეტყობინება (in-app + email) — მხოლოდ წარმატებული გადასვლის შემდეგ, ფონურად
  orderStatusChanged(updated, expected);
  return updated;
};

/**
 * ადმინის მიერ გაუქმება (ცალკე მოქმედება): pending / processing / shipped → cancelled.
 * completed და cancelled — საბოლოო სტატუსებია.
 */
const cancelOrderByAdmin = async (orderId, actorId) => {
  const order = await Order.findById(orderId);
  if (!order) throw httpError(404, 'შეკვეთა ვერ მოიძებნა');
  if (order.status === 'cancelled') throw httpError(409, 'შეკვეთა უკვე გაუქმებულია.', { code: 'ALREADY_CANCELLED' });
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw httpError(409, 'დასრულებული შეკვეთის გაუქმება შეუძლებელია.', { code: 'NOT_CANCELLABLE' });
  }

  const history = { from: order.status, to: 'cancelled', at: new Date(), by: actorId };

  // ბარათით გადაუხდელი შეკვეთა — არსებული ლოგიკა (ბანკის სესიის გაუქმებით)
  if (order.payment?.method === 'card' && order.payment.status !== 'paid') {
    const result = await cancelUnpaidOrder(order, 'გააუქმა ადმინისტრატორმა');
    if (result.alreadyPaid) throw httpError(409, 'შეკვეთა ამ წამს გადაიხადეს — განაახლეთ სია.', { code: 'STATUS_CHANGED' });
    await Order.updateOne({ _id: order._id }, { $push: { statusHistory: history } });
    return Order.findById(order._id);
  }

  const set = { status: 'cancelled' };
  // კურიერთან გადახდა აღარ შედგება; ბარათით გადახდილ თანხას დაბრუნება სჭირდება
  if (order.payment?.method === 'cod' && order.payment.status === 'pay_on_delivery') set['payment.status'] = 'cancelled';
  if (order.payment?.status === 'paid') set['payment.refundRequired'] = true;

  // დაჯავშნილი ვარიანტების მარაგი ბრუნდება (ერთხელ — inventory.reserved ატომურად ითიშება)
  if (order.inventory?.reserved) set['inventory.reserved'] = false;

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: history } },
    { new: true }
  );
  if (!updated) throw httpError(409, 'შეკვეთის სტატუსი უკვე შეიცვალა. განაახლეთ სია.', { code: 'STATUS_CHANGED' });
  if (order.inventory?.reserved) await releaseStock(orderStockLines(order));
  orderStatusChanged(updated, 'cancelled');
  return updated;
};

// ---------------------------------------------------------------------------
// სტატისტიკა — სრული მონაცემებიდან (არა გვერდიდან). ბარათით გადაუხდელი მცდელობები არ ითვლება.
// ---------------------------------------------------------------------------

const getOrderStats = async () => {
  const rows = await Order.aggregate([
    { $match: CONFIRMED_ORDER_MATCH },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totalPrice' } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));
  const count = (s) => by[s]?.count || 0;
  const value = (s) => by[s]?.value || 0;

  const completed = round2(value('completed'));
  const inProgress = round2(IN_PROGRESS_STATUSES.reduce((sum, s) => sum + value(s), 0));
  const counts = {
    pending: count('pending'),
    processing: count('processing'),
    shipped: count('shipped'),
    completed: count('completed'),
    cancelled: count('cancelled'),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    total,
    byStatus: counts,
    values: {
      completed, // მწვანე
      inProgress, // ყვითელი: pending + processing + shipped
      activeTotal: round2(completed + inProgress), // completed + inProgress (გაუქმებულის გარეშე)
      cancelled: round2(value('cancelled')), // წითელი — ცალკე
    },
    // უკუთავსებადობა (ძველი პასუხის ველები)
    pending: counts.pending,
    revenue: round2(completed + inProgress),
  };
};

// ---------------------------------------------------------------------------
// Excel ექსპორტი — ფილტრის მიხედვით, გვერდების გარეშე
// ---------------------------------------------------------------------------

const PAYMENT_STATUS_LABELS = {
  pending: 'მოლოდინში',
  paid: 'გადახდილია',
  pay_on_delivery: 'გადახდა მიტანისას',
  failed: 'წარუმატებელი',
  cancelled: 'გაუქმებული',
  refunded: 'დაბრუნებულია',
};

const EXPORT_MAX_ROWS = 50000;
const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;
// Excel-ს დროის სარტყელი არ აქვს — თარიღი იწერება თბილისის დროით
const toTbilisi = (d) => (d ? new Date(new Date(d).getTime() + TBILISI_OFFSET_MS) : null);
const tbilisiDateString = (d = new Date()) => toTbilisi(d).toISOString().slice(0, 10);

const exportFileName = (d = new Date()) => `Tami Orders - ${tbilisiDateString(d)}.xlsx`;

// ფორმულის ინექციისგან დაცვა: მომხმარებლის ტექსტი, რომელიც =, +, -, @ იწყება, ტექსტად რჩება
const safeText = (v) => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

const MONEY = '#,##0.00 "₾"';
// შეკვეთაში შენახული ვარიანტის snapshot: „ფერი: შავი, მეხსიერება: 256 GB"
const variantText = (i) => (i.variant?.options || []).map((o) => `${o.name}: ${o.value}`).join(', ');
const DATE = 'yyyy-mm-dd hh:mm';

const styleHeader = (ws) => {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
};

/** შეკვეთების ფინანსური დაშლა: ქვეჯამი (ფასდაკლებამდე), ფასდაკლება, მიწოდება, ჯამი */
const orderAmounts = (o) => {
  const itemsTotal = o.itemsTotal ?? o.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const subtotal = o.items.reduce((s, i) => s + (i.oldPrice && i.oldPrice > i.price ? i.oldPrice : i.price) * i.quantity, 0);
  return {
    subtotal: round2(subtotal),
    discount: round2(Math.max(0, subtotal - itemsTotal)),
    delivery: round2(o.delivery?.cost || 0),
    total: round2(o.totalPrice),
  };
};

/**
 * @param {object} filter — იგივე MongoDB ფილტრი, რასაც სია იყენებს (buildAdminOrderFilter)
 * @returns {Promise<{ buffer: Buffer, fileName: string, count: number }>}
 */
const buildOrdersWorkbook = async (filter) => {
  const count = await Order.countDocuments(filter);
  if (count > EXPORT_MAX_ROWS) {
    throw httpError(413, `ძალიან ბევრი შეკვეთა (${count}). დააზუსტეთ ფილტრები (მაქს. ${EXPORT_MAX_ROWS}).`, { code: 'EXPORT_TOO_LARGE' });
  }
  const orders = await Order.find(filter).populate('user', 'email').sort('-createdAt').lean();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tam`i Shop';
  wb.created = new Date();

  // ---- ფურცელი 1: შეკვეთები (ერთი რიგი = ერთი შეკვეთა)
  const ws = wb.addWorksheet('შეკვეთები');
  ws.columns = [
    { header: 'შეკვეთის ნომერი', key: 'number', width: 20 },
    { header: 'თარიღი', key: 'date', width: 18, style: { numFmt: DATE } },
    { header: 'სახელი', key: 'firstName', width: 16 },
    { header: 'გვარი', key: 'lastName', width: 18 },
    { header: 'ტელეფონი', key: 'phone', width: 18 },
    { header: 'ელ. ფოსტა', key: 'email', width: 30 },
    { header: 'სტატუსი', key: 'status', width: 16 },
    { header: 'გადახდის მეთოდი', key: 'paymentMethod', width: 20 },
    { header: 'გადახდის სტატუსი', key: 'paymentStatus', width: 20 },
    { header: 'ქალაქი', key: 'city', width: 16 },
    { header: 'მისამართი', key: 'address', width: 34 },
    { header: 'მიწოდების მეთოდი', key: 'deliveryMethod', width: 24 },
    { header: 'პროდუქტები', key: 'products', width: 50 },
    { header: 'ნივთების რაოდენობა', key: 'itemsCount', width: 12 },
    { header: 'ქვეჯამი', key: 'subtotal', width: 14, style: { numFmt: MONEY } },
    { header: 'ფასდაკლება', key: 'discount', width: 14, style: { numFmt: MONEY } },
    { header: 'მიწოდების ღირებულება', key: 'delivery', width: 14, style: { numFmt: MONEY } },
    { header: 'ჯამი', key: 'total', width: 14, style: { numFmt: MONEY } },
  ];

  // ---- ფურცელი 2: პროდუქტები (ერთი რიგი = ერთი ნივთი შეკვეთაში)
  const wi = wb.addWorksheet('პროდუქტები');
  wi.columns = [
    { header: 'შეკვეთის ნომერი', key: 'number', width: 20 },
    { header: 'თარიღი', key: 'date', width: 18, style: { numFmt: DATE } },
    { header: 'სტატუსი', key: 'status', width: 16 },
    { header: 'პროდუქტი', key: 'name', width: 46 },
    { header: 'ვარიანტი', key: 'variant', width: 34 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'რაოდენობა', key: 'quantity', width: 11 },
    { header: 'ერთეულის ფასი', key: 'price', width: 15, style: { numFmt: MONEY } },
    { header: 'საწყისი ფასი', key: 'oldPrice', width: 15, style: { numFmt: MONEY } },
    { header: 'ფასდაკლება', key: 'discount', width: 14, style: { numFmt: MONEY } },
    { header: 'ჯამი', key: 'lineTotal', width: 15, style: { numFmt: MONEY } },
  ];

  for (const o of orders) {
    const number = o.orderNumber || `#${String(o._id).slice(-6).toUpperCase()}`;
    const date = toTbilisi(o.createdAt);
    const status = ORDER_STATUS_LABELS[o.status] || o.status;
    const info = o.customerInfo || {};
    const address = info.address || {};
    const amounts = orderAmounts(o);

    ws.addRow({
      number,
      date,
      firstName: safeText(info.firstName),
      lastName: safeText(info.lastName),
      phone: safeText(info.phone),
      email: safeText(o.user?.email || ''),
      status,
      paymentMethod: PAYMENT_METHODS[o.payment?.method]?.label || o.payment?.method || '',
      paymentStatus:
        (PAYMENT_STATUS_LABELS[o.payment?.status] || o.payment?.status || '') + (o.payment?.refundRequired ? ' (საჭიროა დაბრუნება)' : ''),
      city: safeText(address.city),
      address: safeText([address.street, address.postalCode].filter(Boolean).join(', ')),
      deliveryMethod: [DELIVERY_METHODS[o.delivery?.method]?.label, o.delivery?.estimate].filter(Boolean).join(' — '),
      products: safeText(
        o.items.map((i) => `${i.name}${i.variant?.options?.length ? ` (${variantText(i)})` : ''} × ${i.quantity}`).join('; ')
      ),
      itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
      ...amounts,
    });

    for (const i of o.items) {
      const original = i.oldPrice && i.oldPrice > i.price ? i.oldPrice : null;
      wi.addRow({
        number,
        date,
        status,
        name: safeText(i.name),
        variant: safeText(variantText(i)),
        sku: safeText(i.variant?.sku || ''),
        quantity: i.quantity,
        price: round2(i.price),
        oldPrice: original ? round2(original) : null,
        discount: original ? round2((original - i.price) * i.quantity) : 0,
        lineTotal: round2(i.price * i.quantity),
      });
    }
  }

  styleHeader(ws);
  styleHeader(wi);
  ws.getColumn('products').alignment = { wrapText: true, vertical: 'top' };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName: exportFileName(), count: orders.length };
};

module.exports = { advanceOrderStatus, cancelOrderByAdmin, getOrderStats, buildOrdersWorkbook, exportFileName };
