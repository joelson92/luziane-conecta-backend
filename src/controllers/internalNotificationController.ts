import { InternalNotification } from "../models/InternalNotification.js";
import { asyncHandler } from "../utils/http.js";

export const listInternalNotifications = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  const notifications = await InternalNotification.find({
    $or: [
      { userId: userId },
      { userId: { $exists: false } },
      { userId: null }
    ]
  }).sort({ createdAt: -1 }).limit(50);

  const mapped = notifications.map(notif => {
    const isRead = notif.userId ? notif.isRead : notif.readBy.includes(userId);
    return {
      _id: notif._id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      referenceId: notif.referenceId,
      isRead,
      createdAt: notif.createdAt
    };
  });

  res.json({ data: mapped });
});

export const getUnreadCount = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;

  const unreadIndividualCount = await InternalNotification.countDocuments({
    userId: userId,
    isRead: false
  });

  const unreadPublicCount = await InternalNotification.countDocuments({
    $or: [{ userId: { $exists: false } }, { userId: null }],
    readBy: { $ne: userId }
  });

  res.json({ data: { count: unreadIndividualCount + unreadPublicCount } });
});

export const markAsRead = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  const notif = await InternalNotification.findById(req.params.id);
  if (!notif) {
    return res.status(404).json({ error: "Notificação não encontrada" });
  }

  if (notif.userId) {
    notif.isRead = true;
  } else {
    if (!notif.readBy.includes(userId)) {
      notif.readBy.push(userId);
    }
  }
  await notif.save();
  res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;

  // Mark all individual notifications as read
  await InternalNotification.updateMany(
    { userId: userId, isRead: false },
    { $set: { isRead: true } }
  );

  // Mark all public notifications as read by adding user to readBy array
  await InternalNotification.updateMany(
    {
      $or: [{ userId: { $exists: false } }, { userId: null }],
      readBy: { $ne: userId }
    },
    { $addToSet: { readBy: userId } }
  );

  res.json({ success: true });
});
