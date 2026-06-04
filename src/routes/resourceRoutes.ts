import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { crudController } from "../controllers/crudController.js";
import { attendEvent, likePost, resolveDemand, sharePost, viewPost, voteSurvey } from "../controllers/domainController.js";
import { createAndSendNotification, createNotification, getNotification, listNotifications, previewNotificationTargets, sendNotification } from "../controllers/notificationController.js";
import { createUser, getUser, listUsers, softDeleteUser, updateUser, updateUserStatus, userActivity, usersByNeighborhood, usersOverview } from "../controllers/userController.js";
import { Demand, Event, Neighborhood, Notification, Post, Survey, User } from "../models/index.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";
import { enrichDemandAddress, enrichUserAddress } from "../services/geocodingService.js";

const postCrud = crudController(Post);
const demandCrud = crudController(Demand, { mineField: "citizenId", mapPayload: async (payload) => enrichDemandAddress(payload) });
const eventCrud = crudController(Event);
const surveyCrud = crudController(Survey);
const notificationCrud = crudController(Notification);
const neighborhoodCrud = crudController(Neighborhood);

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
notificationRoutes.post("/preview-targets", requireAuth, requireRoles(...adminRoles), previewNotificationTargets);
notificationRoutes.post("/send", requireAuth, requireRoles(...adminRoles), createAndSendNotification);
notificationRoutes.post("/", requireAuth, requireRoles(...adminRoles), createNotification);
notificationRoutes.get("/:id", requireAuth, requireRoles(...adminRoles), getNotification);
notificationRoutes.post("/:id/send", requireAuth, requireRoles(...adminRoles), sendNotification);
notificationRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), notificationCrud.update);
notificationRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), notificationCrud.update);
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

export const neighborhoodRoutes = Router();
neighborhoodRoutes.get("/", requireAuth, requireRoles(...adminRoles), neighborhoodCrud.list);
neighborhoodRoutes.post("/", requireAuth, requireRoles(...adminRoles), neighborhoodCrud.create);
neighborhoodRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), neighborhoodCrud.update);
neighborhoodRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), neighborhoodCrud.update);
