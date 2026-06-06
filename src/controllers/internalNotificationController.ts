import { InternalNotification } from "../models/InternalNotification.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { matchesAudience } from "../utils/audience.js";
import { asyncHandler } from "../utils/http.js";

export const listInternalNotifications = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  const fullUser = await User.findById(userId);
  if (!fullUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const notifications = await InternalNotification.find({
    $or: [
      { userId: userId },
      { userId: { $exists: false } },
      { userId: null }
    ]
  }).sort({ createdAt: -1 }).limit(50);

  // Optimize: query all referenced posts at once
  const postIds = notifications
    .filter(n => n.type === "post" && n.referenceId)
    .map(n => n.referenceId);
  const referencedPosts = await Post.find({ _id: { $in: postIds } });
  const postsMap = new Map(referencedPosts.map(p => [p._id.toString(), p]));

  const mapped = [];
  for (const notif of notifications) {
    if (notif.type === "post" && notif.referenceId) {
      const post = postsMap.get(notif.referenceId.toString());
      if (post && !matchesAudience(fullUser, post)) {
        continue;
      }
    }
    const isRead = notif.userId ? notif.isRead : notif.readBy.includes(userId);
    mapped.push({
      _id: notif._id,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      referenceId: notif.referenceId,
      isRead,
      createdAt: notif.createdAt
    });
  }

  res.json({ data: mapped });
});

export const getUnreadCount = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  const fullUser = await User.findById(userId);
  if (!fullUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const unreadIndividualCount = await InternalNotification.countDocuments({
    userId: userId,
    isRead: false
  });

  const publicNotifications = await InternalNotification.find({
    $or: [{ userId: { $exists: false } }, { userId: null }],
    readBy: { $ne: userId }
  });

  // Optimize: query referenced posts at once
  const postIds = publicNotifications
    .filter(n => n.type === "post" && n.referenceId)
    .map(n => n.referenceId);
  const referencedPosts = await Post.find({ _id: { $in: postIds } });
  const postsMap = new Map(referencedPosts.map(p => [p._id.toString(), p]));

  let unreadPublicCount = 0;
  for (const notif of publicNotifications) {
    if (notif.type === "post" && notif.referenceId) {
      const post = postsMap.get(notif.referenceId.toString());
      if (post && !matchesAudience(fullUser, post)) {
        continue;
      }
    }
    unreadPublicCount++;
  }

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
