const mongoose = require('mongoose');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const httpError = require('../../utils/httpError');
const { CHANNELS } = require('./channels');

/*
 * Notification Center — სერვისი.
 *   notify()        — მოვლენა → არხები (in_app → email → მომავალში sms/push). ყოველი არხი იზოლირებულია:
 *                     ერთის შეცდომა მეორეს და უკვე შესრულებულ ბიზნეს-ოპერაციას (მაგ. სტატუსის ცვლილებას) არ ეხება.
 *   list/unread/markRead/markAllRead — მომხმარებლის ოპერაციები, ყოველთვის req.user-ით შეზღუდული.
 */

/**
 * @param {object} p
 * @param {Array<ObjectId|string>} p.userIds  — მიმღებები
 * @param {object} p.notification — Notification-ის ველები (type, source, template/params ან title/message, link, metadata, dedupeKey)
 * @param {string[]} [p.channels] — ['in_app', 'email', ...]; in_app ყოველთვის პირველია
 * @param {object} [p.context] — არხის მონაცემები (მაგ. email: (user) => Promise<{sent}>)
 * @returns {Promise<{ [channel]: { delivered: number, failed: number } }>}
 */
const notify = async ({ userIds, notification, channels = ['in_app'], context = {} }) => {
  const ids = [...new Set(userIds.map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) return {};
  const recipients = await User.find({ _id: { $in: ids }, isActive: true }).select('_id email').lean();
  const results = {};

  // in_app — წყარო; მომდევნო არხები მხოლოდ ახლად მიწოდებულებზე (დუბლიკატზე წერილი არ მეორდება)
  let fresh = recipients;
  for (const name of channels) {
    const channel = CHANNELS[name];
    if (!channel) continue;
    try {
      const r = await channel.deliver({ recipients: fresh, notification, context });
      results[name] = { delivered: r.delivered.length, failed: r.failed, ...(r.skipped ? { skipped: true } : {}) };
      if (name === 'in_app') {
        const set = new Set(r.delivered);
        fresh = recipients.filter((u) => set.has(String(u._id)));
      }
    } catch (err) {
      results[name] = { delivered: 0, failed: fresh.length, error: err.message };
      console.error(`[notify] channel=${name} failed: ${err.message}`);
      if (name === 'in_app') break;
    }
  }
  return results;
};

/** ბიზნეს-ოპერაციის შემდეგ — ფონურად; შეცდომა მხოლოდ ილოგება */
const notifyInBackground = (args) => {
  notify(args).catch((err) => console.error(`[notify] ${err.message}`));
};

// ---------------------------------------------------------------------------
// მომხმარებლის ოპერაციები
// ---------------------------------------------------------------------------

const CAMPAIGN_CONTENT = 'type title message translations link';

/** მომხმარებლისთვის უსაფრთხო ფორმა: შიდა ველები (dedupeKey, recipient, კამპანიის ავტორი) არ ბრუნდება */
const toClient = (n) => {
  const c = n.campaign && typeof n.campaign === 'object' ? n.campaign : null;
  return {
    _id: n._id,
    type: c?.type || n.type,
    source: n.source,
    template: n.template,
    params: n.params,
    title: c ? c.title : n.title,
    message: c ? c.message : n.message,
    translations: c ? c.translations : n.translations,
    link: c ? c.link : n.link,
    metadata: n.metadata?.orderId || n.metadata?.orderNumber || n.metadata?.productId ? n.metadata : undefined,
    read: n.read,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
};

const listForUser = async (userId, { page = 1, limit = 10 } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const filter = { recipient: userId };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('campaign', CAMPAIGN_CONTENT)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);
  return { notifications: items.map(toClient), page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)), total, unread };
};

const unreadCount = (userId) => Notification.countDocuments({ recipient: userId, read: false });

const markRead = async (userId, id) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, 'შეტყობინება ვერ მოიძებნა', { code: 'NOTIFICATION_NOT_FOUND' });
  // recipient ფილტრში — სხვისი შეტყობინება ვერ შეიცვლება (და არც მისი არსებობა ჩანს)
  const n = await Notification.findOneAndUpdate(
    { _id: id, recipient: userId },
    [{ $set: { read: true, readAt: { $ifNull: ['$readAt', '$$NOW'] } } }],
    { new: true }
  )
    .populate('campaign', CAMPAIGN_CONTENT)
    .lean();
  if (!n) throw httpError(404, 'შეტყობინება ვერ მოიძებნა', { code: 'NOTIFICATION_NOT_FOUND' });
  return toClient(n);
};

const markAllRead = async (userId) => {
  const r = await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true, readAt: new Date() } });
  return { updated: r.modifiedCount };
};

module.exports = { notify, notifyInBackground, listForUser, unreadCount, markRead, markAllRead, toClient };
