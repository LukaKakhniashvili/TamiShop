const asyncHandler = require('express-async-handler');
const notifications = require('../services/notifications');
const campaigns = require('../services/notifications/campaigns');

/*
 * Notification Center API. მომხმარებლის endpoint-ები ყოველთვის req.user-ით შემოიფარგლება
 * (frontend-ის userId არ მიიღება); კამპანიები — მხოლოდ admin/manager (routes: staff).
 */

// @desc    ჩემი შეტყობინებები (უახლესი პირველი, გვერდებად) + წაუკითხავების რაოდენობა
// @route   GET /api/notification-list?page=&limit=
// @access  Private
const getMyNotifications = asyncHandler(async (req, res) => {
  res.json(await notifications.listForUser(req.user._id, req.query));
});

// @desc    წაუკითხავების რაოდენობა (header-ის badge — სიის ჩატვირთვის გარეშე)
// @route   GET /api/notification-unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  res.json({ unread: await notifications.unreadCount(req.user._id) });
});

// @desc    ერთი შეტყობინების წაკითხულად მონიშვნა
// @route   PUT /api/notification-read/:id
// @access  Private (მხოლოდ საკუთარი)
const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notifications.markRead(req.user._id, req.params.id);
  res.json({ notification, unread: await notifications.unreadCount(req.user._id) });
});

// @desc    ყველას წაკითხულად მონიშვნა
// @route   PUT /api/notification-read-all
// @access  Private
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const r = await notifications.markAllRead(req.user._id);
  res.json({ ...r, unread: 0 });
});

// @desc    კამპანიის შექმნა და გაგზავნა (ფონურად)
// @route   POST /api/notification-campaign-create
// @access  Admin / Manager
const createCampaign = asyncHandler(async (req, res) => {
  const { campaign, duplicate } = await campaigns.createCampaign(req.body, req.user._id);
  res.status(duplicate ? 200 : 202).json({ campaign, duplicate });
});

// @desc    გაგზავნილი კამპანიები (აუდიტი: ავტორი, დრო, აუდიტორია, არხები, შედეგი)
// @route   GET /api/notification-campaign-list?page=&limit=
// @access  Admin / Manager
const listCampaigns = asyncHandler(async (req, res) => {
  const [list, eligibleCustomers] = await Promise.all([campaigns.listCampaigns(req.query), campaigns.countEligibleCustomers()]);
  res.json({ ...list, eligibleCustomers });
});

// @desc    მიმღებების ძიება (?q=) ან არჩეულების ჩატვირთვა (?ids=a,b)
// @route   GET /api/notification-recipient-search
// @access  Admin / Manager
const searchRecipients = asyncHandler(async (req, res) => {
  res.json({ users: await campaigns.searchRecipients(req.query) });
});

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  createCampaign,
  listCampaigns,
  searchRecipients,
};
