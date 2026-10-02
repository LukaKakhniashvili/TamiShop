const mongoose = require('mongoose');

/*
 * ხელით გაგზავნილი შეტყობინება / მარკეტინგული კამპანია (ადმინი / მენეჯერი).
 * ინახავს შინაარსს (ქართული + translations.{en,ru}), აუდიტორიას, არხებს, ავტორს და მიწოდების შედეგს.
 * ავტორი (createdBy) მომხმარებელს არასდროს უჩანს — notification-ის API მხოლოდ შინაარსის ველებს აბრუნებს.
 *
 * მიწოდება: services/notifications/campaigns.js (ახლა — იმავე პროცესში, პარტიებად; შემდგომში შესაძლებელია
 * რიგში / background worker-ში გადატანა — status ველი სწორედ ამისთვისაა).
 */

const CAMPAIGN_TYPES = ['marketing', 'promotion', 'system'];
const AUDIENCE_MODES = ['user', 'selected', 'all'];

const campaignSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: CAMPAIGN_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    translations: { type: mongoose.Schema.Types.Mixed, default: undefined },
    link: { type: String },
    // მომავალში: promoCode (კამპანიის შინაარსის ნაწილი — notification-ის სქემა არ იცვლება)

    audience: {
      mode: { type: String, enum: AUDIENCE_MODES, required: true },
      userIds: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    },
    channels: { type: [String], default: ['in_app'] },

    status: { type: String, enum: ['queued', 'sending', 'completed', 'failed'], default: 'queued' },
    recipientCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },

    // ფორმის ერთი გაგზავნა = ერთი კამპანია (ორმაგი დაჭერა / ხელახალი მოთხოვნა ახალ კამპანიას არ ქმნის)
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

campaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NotificationCampaign', campaignSchema);
module.exports.CAMPAIGN_TYPES = CAMPAIGN_TYPES;
module.exports.AUDIENCE_MODES = AUDIENCE_MODES;
