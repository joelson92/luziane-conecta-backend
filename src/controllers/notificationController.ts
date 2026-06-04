import { Notification } from "../models/index.js";
import { asyncHandler } from "../utils/http.js";
import { sendPushToTokens } from "../services/notificationService.js";
import { normalizeFilters, normalizeTargetType, resolveNotificationTargets } from "../services/notificationTargetService.js";

export const listNotifications = asyncHandler(async (_req, res) => {
  const data = await Notification.find().sort({ createdAt: -1 }).limit(200);
  res.json({ data });
});

export const getNotification = asyncHandler(async (req, res) => {
  const data = await Notification.findById(req.params.id);
  if (!data) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }
  res.json({ data });
});

export const previewNotificationTargets = asyncHandler(async (req, res) => {
  const targetType = normalizeTargetType(req.body.targetType);
  const targetFilters = normalizeFilters(req.body.targetFilters ?? {});
  const preview = await resolveNotificationTargets(targetType, targetFilters);
  res.json({ totalRecipients: preview.totalRecipients, breakdown: preview.breakdown });
});

export const createNotification = asyncHandler(async (req: any, res) => {
  const targetType = normalizeTargetType(req.body.targetType);
  const targetFilters = normalizeFilters(req.body.targetFilters ?? {});
  const preview = await resolveNotificationTargets(targetType, targetFilters);
  const notification = await Notification.create({
    title: req.body.title,
    message: req.body.message ?? req.body.body,
    body: req.body.body ?? req.body.message,
    targetType,
    targetFilters,
    recipientCount: preview.totalRecipients,
    status: req.body.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT",
    createdBy: req.user?.id
  });
  res.status(201).json({ data: notification, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});

export const sendNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }

  const preview = await resolveNotificationTargets(normalizeTargetType(notification.get("targetType")), normalizeFilters((notification.get("targetFilters") ?? {}) as any));
  const result = await sendPushToTokens(preview.tokens, notification.get("title"), notification.get("message") ?? notification.get("body"));
  notification.set("recipientCount", preview.totalRecipients);
  notification.set("sentCount", result.sent);
  notification.set("status", result.skipped && preview.totalRecipients > 0 ? "FAILED" : "SENT");
  notification.set("sentAt", new Date());
  await notification.save();
  res.json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});

export const createAndSendNotification = asyncHandler(async (req: any, res) => {
  const targetType = normalizeTargetType(req.body.targetType);
  const targetFilters = normalizeFilters(req.body.targetFilters ?? {});
  const preview = await resolveNotificationTargets(targetType, targetFilters);
  const result = await sendPushToTokens(preview.tokens, req.body.title, req.body.message ?? req.body.body);
  const notification = await Notification.create({
    title: req.body.title,
    message: req.body.message ?? req.body.body,
    body: req.body.body ?? req.body.message,
    targetType,
    targetFilters,
    recipientCount: preview.totalRecipients,
    sentCount: result.sent,
    status: result.skipped && preview.totalRecipients > 0 ? "FAILED" : "SENT",
    createdBy: req.user?.id,
    sentAt: new Date()
  });
  res.status(201).json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});
