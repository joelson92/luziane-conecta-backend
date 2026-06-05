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
export const createNotification = asyncHandler(async (req, res) => {
    const targetType = normalizeTargetType(req.body.targetType);
    const targetFilters = normalizeFilters(req.body.targetFilters ?? {});
    const preview = await resolveNotificationTargets(targetType, targetFilters);
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined;
    const recurrence = req.body.recurrence ?? "NONE";
    const isScheduled = scheduledAt && scheduledAt > new Date();
    const notification = await Notification.create({
        title: req.body.title,
        message: req.body.message ?? req.body.body,
        body: req.body.body ?? req.body.message,
        targetType,
        targetFilters,
        recipientCount: preview.totalRecipients,
        scheduledAt,
        recurrence,
        status: isScheduled ? "SCHEDULED" : (req.body.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT"),
        createdBy: req.user?.id
    });
    res.status(201).json({ data: notification, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});
export const updateNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
        res.status(404).json({ message: "Notification not found" });
        return;
    }
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : notification.get("scheduledAt");
    const recurrence = req.body.recurrence ?? notification.get("recurrence") ?? "NONE";
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    const targetType = req.body.targetType ? normalizeTargetType(req.body.targetType) : normalizeTargetType(notification.get("targetType"));
    const rawFilters = req.body.targetFilters ? normalizeFilters(req.body.targetFilters) : normalizeFilters((notification.get("targetFilters") ?? {}));
    const preview = await resolveNotificationTargets(targetType, rawFilters);
    const updated = await Notification.findByIdAndUpdate(req.params.id, {
        title: req.body.title ?? notification.get("title"),
        message: req.body.message ?? req.body.body ?? notification.get("message"),
        body: req.body.body ?? req.body.message ?? notification.get("body"),
        targetType,
        targetFilters: rawFilters,
        recipientCount: preview.totalRecipients,
        scheduledAt,
        recurrence,
        status: isScheduled ? "SCHEDULED" : (notification.get("status") === "SENT" ? "SENT" : "DRAFT")
    }, { new: true });
    res.json({ data: updated, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});
export const sendNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
        res.status(404).json({ message: "Notification not found" });
        return;
    }
    const preview = await resolveNotificationTargets(normalizeTargetType(notification.get("targetType")), normalizeFilters((notification.get("targetFilters") ?? {})));
    const result = await sendPushToTokens(preview.tokens, notification.get("title"), notification.get("message") ?? notification.get("body"));
    notification.set("recipientCount", preview.totalRecipients);
    notification.set("sentCount", result.sent);
    notification.set("status", result.skipped && preview.totalRecipients > 0 ? "FAILED" : "SENT");
    notification.set("sentAt", new Date());
    await notification.save();
    res.json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});
export const createAndSendNotification = asyncHandler(async (req, res) => {
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
        recurrence: "NONE",
        status: result.skipped && preview.totalRecipients > 0 ? "FAILED" : "SENT",
        createdBy: req.user?.id,
        sentAt: new Date()
    });
    res.status(201).json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});
/** POST /api/notifications/:id/open — incrementa openedCount (chamado pelo app mobile) */
export const trackOpen = asyncHandler(async (req, res) => {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { $inc: { openedCount: 1 } }, { new: true });
    if (!updated) {
        res.status(404).json({ message: "Notification not found" });
        return;
    }
    res.json({ ok: true });
});
/** POST /api/notifications/:id/click — incrementa clickedCount (chamado pelo app mobile) */
export const trackClick = asyncHandler(async (req, res) => {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { $inc: { clickedCount: 1 } }, { new: true });
    if (!updated) {
        res.status(404).json({ message: "Notification not found" });
        return;
    }
    res.json({ ok: true });
});
/** GET /api/notifications/stats — métricas agregadas de todas as notificações */
export const notificationStats = asyncHandler(async (_req, res) => {
    const result = await Notification.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                sent: { $sum: { $cond: [{ $eq: ["$status", "SENT"] }, 1, 0] } },
                scheduled: { $sum: { $cond: [{ $eq: ["$status", "SCHEDULED"] }, 1, 0] } },
                drafts: { $sum: { $cond: [{ $eq: ["$status", "DRAFT"] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
                totalRecipients: { $sum: "$recipientCount" },
                totalSent: { $sum: "$sentCount" },
                totalDelivered: { $sum: "$deliveredCount" },
                totalOpened: { $sum: "$openedCount" },
                totalClicked: { $sum: "$clickedCount" }
            }
        }
    ]);
    const stats = result[0] ?? {
        total: 0, sent: 0, scheduled: 0, drafts: 0, failed: 0,
        totalRecipients: 0, totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0
    };
    const openRate = stats.totalSent > 0 ? Math.round((stats.totalOpened / stats.totalSent) * 100) : 0;
    const clickRate = stats.totalOpened > 0 ? Math.round((stats.totalClicked / stats.totalOpened) * 100) : 0;
    res.json({
        data: {
            ...stats,
            openRate,
            clickRate
        }
    });
});
