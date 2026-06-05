import { Router } from "express";
import { z } from "zod";
import { crudController } from "../controllers/crudController.js";
import { attendEvent, likePost, resolveDemand, sharePost, viewPost, voteSurvey } from "../controllers/domainController.js";
import { createAndSendNotification, createNotification, getNotification, listNotifications, notificationStats, previewNotificationTargets, sendNotification, trackClick, trackOpen, updateNotification } from "../controllers/notificationController.js";
import { createUser, getUser, listUsers, softDeleteUser, updateUser, updateUserStatus, userActivity, usersByNeighborhood, usersOverview } from "../controllers/userController.js";
import { Demand, Event, Notification, Post, Survey } from "../models/index.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { enrichDemandAddress } from "../services/geocodingService.js";
const postCrud = crudController(Post);
const demandCrud = crudController(Demand, { mineField: "citizenId", mapPayload: async (payload) => enrichDemandAddress(payload) });
const eventCrud = crudController(Event);
const surveyCrud = crudController(Survey);
const notificationCrud = crudController(Notification);
export const postRoutes = Router();
postRoutes.get("/", postCrud.list);
postRoutes.get("/:id", postCrud.get);
postRoutes.post("/", requireAuth, requireRoles(...adminRoles), postCrud.create);
postRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), postCrud.update);
postRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), postCrud.update);
postRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), postCrud.remove);
postRoutes.post("/:id/like", requireAuth, likePost);
postRoutes.post("/:id/view", viewPost);
postRoutes.post("/:id/share", sharePost);
export const demandRoutes = Router();
demandRoutes.get("/", requireAuth, demandCrud.list);
demandRoutes.get("/:id", requireAuth, demandCrud.get);
demandRoutes.post("/", requireAuth, demandCrud.create);
demandRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), demandCrud.update);
demandRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), demandCrud.update);
demandRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), demandCrud.remove);
demandRoutes.post("/:id/resolve", requireAuth, requireRoles(...adminRoles), resolveDemand);
export const eventRoutes = Router();
eventRoutes.get("/", eventCrud.list);
eventRoutes.get("/:id", eventCrud.get);
eventRoutes.post("/", requireAuth, requireRoles(...adminRoles), eventCrud.create);
eventRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), eventCrud.update);
eventRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), eventCrud.update);
eventRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), eventCrud.remove);
eventRoutes.post("/:id/attend", requireAuth, attendEvent);
export const surveyRoutes = Router();
surveyRoutes.get("/", surveyCrud.list);
surveyRoutes.get("/:id", surveyCrud.get);
surveyRoutes.post("/", requireAuth, requireRoles(...adminRoles), surveyCrud.create);
surveyRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), surveyCrud.update);
surveyRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), surveyCrud.update);
surveyRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), surveyCrud.remove);
surveyRoutes.post("/:id/vote", requireAuth, validate(z.object({ optionId: z.string() })), voteSurvey);
export const notificationRoutes = Router();
notificationRoutes.get("/", requireAuth, requireRoles(...adminRoles), listNotifications);
notificationRoutes.get("/stats", requireAuth, requireRoles(...adminRoles), notificationStats);
notificationRoutes.post("/preview-targets", requireAuth, requireRoles(...adminRoles), previewNotificationTargets);
notificationRoutes.post("/send", requireAuth, requireRoles(...adminRoles), createAndSendNotification);
notificationRoutes.post("/", requireAuth, requireRoles(...adminRoles), createNotification);
notificationRoutes.get("/:id", requireAuth, requireRoles(...adminRoles), getNotification);
notificationRoutes.post("/:id/send", requireAuth, requireRoles(...adminRoles), sendNotification);
notificationRoutes.post("/:id/open", trackOpen);
notificationRoutes.post("/:id/click", trackClick);
notificationRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), updateNotification);
notificationRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), updateNotification);
notificationRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), notificationCrud.remove);
export const userRoutes = Router();
userRoutes.use(requireAuth, requireRoles(...adminRoles));
userRoutes.get("/", listUsers);
userRoutes.get("/stats/overview", usersOverview);
userRoutes.get("/stats/neighborhoods", usersByNeighborhood);
userRoutes.post("/", requireRoles("SUPER_ADMIN", "PREFEITA", "ASSESSOR"), createUser);
userRoutes.get("/:id/activity", userActivity);
userRoutes.get("/:id", getUser);
userRoutes.put("/:id", requireRoles("SUPER_ADMIN", "PREFEITA", "ASSESSOR"), updateUser);
userRoutes.patch("/:id/status", requireRoles("SUPER_ADMIN", "PREFEITA", "ASSESSOR"), updateUserStatus);
userRoutes.delete("/:id", requireRoles("SUPER_ADMIN", "PREFEITA", "ASSESSOR"), softDeleteUser);
// ─── Neighborhood Routes — DESCONTINUADO ─────────────────────────────────────
// O módulo "Bairros" foi removido da interface.
// Todos os dados territoriais derivam de User.
// Esta rota existe apenas para evitar 404 em chamadas legadas.
export const neighborhoodRoutes = Router();
neighborhoodRoutes.all("*", (_req, res) => {
    res.status(410).json({
        error: "Gone",
        message: "O módulo Bairros foi descontinuado. Use GET /api/map/neighborhoods ou /api/map/neighborhoods-stats para dados territoriais derivados de usuários cadastrados.",
        alternatives: [
            "GET /api/map/neighborhoods",
            "GET /api/map/neighborhoods-stats",
            "GET /api/map/communities"
        ]
    });
});
