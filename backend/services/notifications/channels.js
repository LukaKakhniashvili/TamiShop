const Notification = require('../../models/Notification');

/*
 * მიწოდების არხები. თითო არხი: deliver({ recipients, notification, context }) → { delivered: [userId], failed }.
 * ახალი არხი (sms, web_push, mobile_push) ემატება აქ, ერთი ობიექტით — notify() და მოვლენები არ იცვლება.
 */

const BATCH = 500;

/**
 * შიდა (in-app) შეტყობინება — ბაზაში, პარტიებად (ერთი bulkWrite ყოველ 500 მიმღებზე, N+1-ის გარეშე).
 * dedupeKey-ით: upsert ($setOnInsert) — არსებული არ იცვლება და არ ითვლება მიწოდებულად; ატომური და
 * კონკურენტულ მოთხოვნებზე უსაფრთხო (unique ინდექსი recipient + dedupeKey).
 */
const inApp = {
  name: 'in_app',
  async deliver({ recipients, notification }) {
    const delivered = [];
    let failed = 0;
    const now = new Date();
    for (let i = 0; i < recipients.length; i += BATCH) {
      const slice = recipients.slice(i, i + BATCH);
      const ops = slice.map((r) =>
        notification.dedupeKey
          ? {
              updateOne: {
                filter: { recipient: r._id, dedupeKey: notification.dedupeKey },
                update: { $setOnInsert: { ...notification, recipient: r._id, read: false, createdAt: now } },
                upsert: true,
              },
            }
          : { insertOne: { document: { ...notification, recipient: r._id, read: false, createdAt: now } } }
      );
      try {
        const res = await Notification.bulkWrite(ops, { ordered: false });
        const created = notification.dedupeKey ? Object.keys(res.upsertedIds || {}) : Object.keys(res.insertedIds || {});
        delivered.push(...created.map((idx) => String(slice[Number(idx)]._id)));
      } catch (err) {
        // კონკურენტული upsert-ის დუბლიკატი (E11000) — ესე იგი უკვე მიწოდებულია; სხვა შეცდომა ითვლება
        const errors = err.writeErrors || [];
        const created = err.result?.upsertedIds || err.result?.insertedIds || {};
        delivered.push(...Object.keys(created).map((idx) => String(slice[Number(idx)]._id)));
        failed += errors.filter((e) => (e.code ?? e.err?.code) !== 11000).length;
        if (!errors.length) throw err;
      }
    }
    return { delivered, failed };
  },
};

/**
 * ელ. ფოსტა — არსებული emailService-ით (context.email(recipient) აბრუნებს { sent }).
 * იგზავნება მხოლოდ მათთან, ვისაც in-app შეტყობინება ახლა შეექმნა (ხელახალ მოთხოვნაზე წერილი არ მეორდება).
 */
const email = {
  name: 'email',
  async deliver({ recipients, context }) {
    if (typeof context?.email !== 'function') return { delivered: [], failed: 0, skipped: true };
    const delivered = [];
    let failed = 0;
    for (const r of recipients) {
      if (!r.email) continue;
      try {
        const result = await context.email(r);
        if (result?.sent) delivered.push(String(r._id));
        else failed++;
      } catch (err) {
        failed++;
        console.error(`[notify:email] ${err.message}`);
      }
    }
    return { delivered, failed };
  },
};

const CHANNELS = { in_app: inApp, email };

module.exports = { CHANNELS, BATCH };
