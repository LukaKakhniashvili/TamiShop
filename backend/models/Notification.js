const mongoose = require('mongoose');

/*
 * მომხმარებლის შეტყობინება (Notification Center). ერთი დოკუმენტი = ერთი მიმღები.
 *
 * შინაარსის სამი წყარო (ერთი სქემა):
 *   template + params — სისტემური (მაგ. order_status / { status, orderNumber }); ტექსტს frontend-ი
 *                       მომხმარებლის მიმდინარე ენაზე აწყობს (ენის შეცვლისას არ „ტყდება")
 *   campaign          — ხელით გაგზავნილი კამპანია: ტექსტი ინახება კამპანიაში (არ დუბლირდება ათასობით მიმღებზე)
 *   title / message   — პირდაპირი ტექსტი (ქართული, საბაზისო) + translations.{en,ru} — როგორც პროდუქტებში
 *
 * dedupeKey — ერთი მოვლენა ერთ მომხმარებელს მხოლოდ ერთხელ (უნიკალური ინდექსი; კონკურენტულ მოთხოვნებზეც).
 */

const NOTIFICATION_TYPES = ['order', 'marketing', 'promotion', 'system'];
const NOTIFICATION_SOURCES = ['automatic', 'manual'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    source: { type: String, enum: NOTIFICATION_SOURCES, required: true },

    template: { type: String },
    params: { type: mongoose.Schema.Types.Mixed, default: undefined },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationCampaign' },
    title: { type: String },
    message: { type: String },
    translations: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // მხოლოდ საიტის შიდა ბმული (/profile?tab=orders&order=...), იხ. utils/internalLink.js
    link: { type: String },
    // მომხმარებლისთვის უსაფრთხო მითითებები (orderId, orderNumber, productId)
    metadata: {
      orderId: { type: mongoose.Schema.Types.ObjectId },
      orderNumber: { type: String },
      productId: { type: mongoose.Schema.Types.ObjectId },
    },

    read: { type: Boolean, default: false },
    readAt: { type: Date },
    dedupeKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// სია (უახლესი პირველი) და წაუკითხავების დათვლა
notificationSchema.index({ recipient: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
// დუბლირების დაცვა
notificationSchema.index({ recipient: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
