import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { crudController } from "../controllers/crudController.js";
import { attendEvent, likePost, resolveDemand, sharePost, viewPost, voteSurvey } from "../controllers/domainController.js";
import { createAndSendNotification, createNotification, getNotification, listNotifications, notificationStats, previewNotificationTargets, sendNotification, trackClick, trackOpen, updateNotification } from "../controllers/notificationController.js";
import { createUser, getUser, listUsers, softDeleteUser, updateUser, updateUserStatus, userActivity, usersByNeighborhood, usersOverview, deleteUserPermanent, resetUserPassword } from "../controllers/userController.js";
import { Demand, Event, Notification, Post, Survey, User, Video } from "../models/index.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";
import { enrichDemandAddress, enrichUserAddress } from "../services/geocodingService.js";

import path from "path";
import multer from "multer";
import { uploadDirectFile } from "../services/uploadService.js";

const postCrud = crudController(Post);

const videoCrud = crudController(Video, {
  mapPayload: async (payload, req) => {
    if (req.method === "POST") {
      return { ...payload, createdBy: req.user?.id, updatedBy: req.user?.id };
    }
    return { ...payload, updatedBy: req.user?.id };
  }
});

const demandCrud = crudController(Demand, { mineField: "citizenId", mapPayload: async (payload) => enrichDemandAddress(payload) });
const eventCrud = crudController(Event);
const surveyCrud = crudController(Survey);
const notificationCrud = crudController(Notification);

// Multer Setup for video upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ["video/mp4", "video/quicktime", "video/webm"];
    const allowedExtensions = [".mp4", ".mov", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(ext)) {
      return cb(new Error("Apenas vídeos mp4, mov, webm são permitidos."));
    }
    cb(null, true);
  }
});

const uploadSingleVideo = upload.single("video");

export const uploadVideoHandler = asyncHandler(async (req: any, res) => {
  uploadSingleVideo(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    
    try {
      const { buffer, originalname, mimetype, size } = req.file;
      const result = await uploadDirectFile("videos", originalname, buffer, mimetype);
      
      res.json({
        url: result.publicUrl,
        key: result.key,
        originalName: originalname,
        mimeType: mimetype,
        size
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erro ao fazer upload do vídeo." });
    }
  });
});

export const adminRoutes = Router();
adminRoutes.post("/videos/upload", requireAuth, requireRoles(...adminRoles), uploadVideoHandler);

import { matchesAudience } from "../utils/audience.js";

export const listMyPosts = asyncHandler(async (req: any, res) => {
  const fullUser = await User.findById(req.user.id);
  if (!fullUser) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  const posts = await Post.find({ status: "published" }).sort({ createdAt: -1 }).limit(200);
  const filtered = posts.filter(post => matchesAudience(fullUser, post));
  res.json({ data: filtered });
});

export const postRoutes = Router();
postRoutes.get("/my", requireAuth, listMyPosts);
postRoutes.get("/", postCrud.list);
postRoutes.get("/:id", postCrud.get);
postRoutes.post("/", requireAuth, requireRoles(...adminRoles), postCrud.create);
postRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), postCrud.update);
postRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), postCrud.update);
postRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), postCrud.remove);
postRoutes.post("/:id/like", requireAuth, likePost);
postRoutes.post("/:id/view", viewPost);
postRoutes.post("/:id/share", sharePost);

export const videoRoutes = Router();
videoRoutes.get("/", videoCrud.list);
videoRoutes.get("/:id", videoCrud.get);
videoRoutes.post("/", requireAuth, requireRoles(...adminRoles), videoCrud.create);
videoRoutes.patch("/:id", requireAuth, requireRoles(...adminRoles), videoCrud.update);
videoRoutes.put("/:id", requireAuth, requireRoles(...adminRoles), videoCrud.update);
videoRoutes.delete("/:id", requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA"), videoCrud.remove);

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

import { listInternalNotifications } from "../controllers/internalNotificationController.js";

export const notificationRoutes = Router();
notificationRoutes.get("/my", requireAuth, listInternalNotifications);
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
userRoutes.delete("/:id/permanent", requireRoles("SUPER_ADMIN", "PREFEITA"), deleteUserPermanent);
userRoutes.patch("/:id/reset-password", requireRoles("SUPER_ADMIN", "PREFEITA", "ASSESSOR"), resetUserPassword);


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
