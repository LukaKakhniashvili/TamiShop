const mongoose = require('mongoose');
const NotificationCampaign = require('../../models/NotificationCampaign');
const { CAMPAIGN_TYPES, AUDIENCE_MODES } = require('../../models/NotificationCampaign');
const User = require('../../models/User');
const httpError = require('../../utils/httpError');
const { isInternalLink } = require('../../utils/internalLink');
const { TRANSLATION_LANGUAGES } = require('../../utils/translations');
const { CHANNELS, BATCH } = require('./channels');

/*
 * ხელით გაგზავნილი შეტყობინებები / კამპანიები (ადმინი, მენეჯერი).
 *   createCampaign  — ვალიდაცია + ჩანაწერი (status: queued) → მიწოდება იწყება ფონურად
 *   deliverCampaign — მიმღებების პარტიებად დამუშავება (cursor + bulkWrite, N+1-ის გარეშე).
 *                     დამოუკიდებელი ფუნქციაა: შემდგომში შესაძლებელია რიგში / worker-ში გადატანა.
 * კამპანიის შეტყობინებები შინაარსს არ აკოპირებენ — მიუთითებენ კამპანიაზე (campaign ველი).
 */

const LIMITS = { title: 120, message: 1000, userIds: 1000 };
const CAMPAIGN_CHANNELS = ['in_app']; // ელ. ფოსტით მარკეტინგი — მომავალში (გამოწერის მართვით)

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const bad = (message, field) => httpError(400, message, { code: 'INVALID_CAMPAIGN', field });

const eligibleCustomers = { role: 'customer', isActive: true };

/** მოთხოვნის ვალიდაცია → კამპანიის ველები */
const validateCampaign = async (body) => {
  const type = body.type;
  if (!CAMPAIGN_TYPES.includes(type)) throw bad('არასწორი შეტყობინების ტიპი', 'type');
  const title = text(body.title);
  const message = text(body.message);
  if (!title || title.length > LIMITS.title) throw bad(`სათაური სავალდებულოა (მაქს. ${LIMITS.title} სიმბოლო)`, 'title');
  if (!message || message.length > LIMITS.message) throw bad(`ტექსტი სავალდებულოა (მაქს. ${LIMITS.message} სიმბოლო)`, 'message');

  // თარგმანები (არასავალდებულო) — ცარიელი ენა/ველი არ ინახება, მაშინ მომხმარებელი ქართულს ხედავს
  const translations = {};
  for (const lng of TRANSLATION_LANGUAGES) {
    const src = body.translations?.[lng] || {};
    const t = text(src.title);
    const m = text(src.message);
    if (t.length > LIMITS.title || m.length > LIMITS.message) throw bad(`თარგმანი (${lng}) ძალიან გრძელია`, 'translations');
    if (t || m) translations[lng] = { ...(t ? { title: t } : {}), ...(m ? { message: m } : {}) };
  }

  const link = text(body.link);
  if (link && !isInternalLink(link)) throw bad('ბმული უნდა იყოს საიტის შიდა მისამართი, მაგ. /products?sale=1', 'link');

  const mode = body.audience?.mode;
  if (!AUDIENCE_MODES.includes(mode)) throw bad('აირჩიეთ მიმღებები', 'audience');
  let userIds;
  if (mode === 'all') {
    if (body.confirmAll !== true) throw bad('ყველა მომხმარებლისთვის გაგზავნა საჭიროებს დადასტურებას', 'confirmAll');
  } else {
    const raw = Array.isArray(body.audience?.userIds) ? body.audience.userIds.map(String) : [];
    userIds = [...new Set(raw)];
    if (!userIds.length) throw bad('აირჩიეთ მინიმუმ ერთი მომხმარებელი', 'audience');
    if (mode === 'user' && userIds.length !== 1) throw bad('აირჩიეთ ერთი მომხმარებელი', 'audience');
    if (userIds.length > LIMITS.userIds) throw bad(`მაქსიმუმ ${LIMITS.userIds} მომხმარებელი`, 'audience');
    if (userIds.some((id) => !mongoose.isValidObjectId(id))) throw bad('მომხმარებლის არასწორი იდენტიფიკატორი', 'audience');
    const found = await User.countDocuments({ _id: { $in: userIds }, ...eligibleCustomers });
    if (found !== userIds.length) throw bad('ზოგიერთი მომხმარებელი ვერ მოიძებნა ან არ არის აქტიური მყიდველი', 'audience');
  }

  const idempotencyKey = text(body.idempotencyKey);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(idempotencyKey)) throw bad('იდენტიფიკატორი არასწორია — განაახლეთ გვერდი', 'idempotencyKey');

  return {
    type,
    title,
    message,
    translations: Object.keys(translations).length ? translations : undefined,
    link: link || undefined,
    audience: { mode, ...(userIds ? { userIds } : {}) },
    channels: CAMPAIGN_CHANNELS,
    idempotencyKey,
  };
};

/**
 * კამპანიის მიწოდება. ატომურად „იჭერს" კამპანიას (queued → sending), რომ ორჯერ არ გაიგზავნოს;
 * ხელახალი გაშვება (მაგ. worker-ის restart) დუბლიკატს არ ქმნის — dedupeKey: campaign:<id>.
 */
const deliverCampaign = async (campaignId) => {
  const campaign = await NotificationCampaign.findOneAndUpdate(
    { _id: campaignId, status: 'queued' },
    { $set: { status: 'sending', startedAt: new Date() } },
    { new: true }
  );
  if (!campaign) return null;

  const filter = campaign.audience.mode === 'all' ? eligibleCustomers : { _id: { $in: campaign.audience.userIds }, ...eligibleCustomers };
  const notification = {
    type: campaign.type,
    source: 'manual',
    campaign: campaign._id,
    dedupeKey: `campaign:${campaign._id}`,
  };

  let recipientCount = 0;
  let deliveredCount = 0;
  try {
    const cursor = User.find(filter).select('_id').lean().cursor({ batchSize: BATCH });
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const r = await CHANNELS.in_app.deliver({ recipients: batch, notification });
      recipientCount += batch.length;
      deliveredCount += r.delivered.length;
      batch = [];
    };
    for await (const u of cursor) {
      batch.push(u);
      if (batch.length >= BATCH) await flush();
    }
    await flush();
    await NotificationCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: 'completed', recipientCount, deliveredCount, completedAt: new Date() } }
    );
  } catch (err) {
    console.error(`[campaign] ${campaign._id} failed: ${err.message}`);
    await NotificationCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: 'failed', recipientCount, deliveredCount, error: err.message.slice(0, 300), completedAt: new Date() } }
    );
  }
  return NotificationCampaign.findById(campaign._id);
};

/** ახალი კამპანია; იგივე idempotencyKey → არსებული კამპანია ბრუნდება (ახალი გაგზავნა არ ხდება) */
const createCampaign = async (body, actorId) => {
  const data = await validateCampaign(body);
  const existing = await NotificationCampaign.findOne({ idempotencyKey: data.idempotencyKey }).lean();
  if (existing) return { campaign: existing, duplicate: true };
  let campaign;
  try {
    campaign = await NotificationCampaign.create({ ...data, createdBy: actorId });
  } catch (err) {
    if (err.code === 11000) return { campaign: await NotificationCampaign.findOne({ idempotencyKey: data.idempotencyKey }).lean(), duplicate: true };
    throw err;
  }
  // ფონური მიწოდება (პასუხი არ ელოდება — დიდ აუდიტორიაზეც სწრაფია)
  setImmediate(() => deliverCampaign(campaign._id).catch((e) => console.error(`[campaign] ${e.message}`)));
  return { campaign: campaign.toObject(), duplicate: false };
};

const listCampaigns = async ({ page = 1, limit = 10 } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const [items, total] = await Promise.all([
    NotificationCampaign.find({})
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('createdBy', 'firstName lastName email role')
      .select('-idempotencyKey')
      .lean(),
    NotificationCampaign.countDocuments({}),
  ]);
  return { campaigns: items, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)), total };
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** მიმღების ძიება (სახელი, გვარი, ელ. ფოსტა, ტელეფონი) — მხოლოდ აქტიური მყიდველები; ids= — არჩეულების ჩატვირთვა */
const searchRecipients = async ({ q, ids }) => {
  const fields = 'firstName lastName email phone';
  if (ids) {
    const list = String(ids).split(',').filter((id) => mongoose.isValidObjectId(id)).slice(0, LIMITS.userIds);
    return User.find({ _id: { $in: list }, ...eligibleCustomers }).select(fields).lean();
  }
  const term = text(q).slice(0, 60);
  if (term.length < 2) return [];
  const re = new RegExp(escapeRegex(term), 'i');
  return User.find({ ...eligibleCustomers, $or: [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }] })
    .select(fields)
    .sort({ firstName: 1 })
    .limit(20)
    .lean();
};

const countEligibleCustomers = () => User.countDocuments(eligibleCustomers);

module.exports = { createCampaign, deliverCampaign, listCampaigns, searchRecipients, countEligibleCustomers, validateCampaign };
