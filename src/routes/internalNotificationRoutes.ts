import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listInternalNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../controllers/internalNotificationController.js";

export const internalNotificationRoutes = Router();

internalNotificationRoutes.use(requireAuth);

internalNotificationRoutes.get("/my", listInternalNotifications);
internalNotificationRoutes.get("/", listInternalNotifications);
internalNotificationRoutes.get("/unread-count", getUnreadCount);
internalNotificationRoutes.post("/read-all", markAllAsRead);
internalNotificationRoutes.post("/:id/read", markAsRead);
