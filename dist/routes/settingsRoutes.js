import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
export const settingsRoutes = Router();
settingsRoutes.use(requireAuth, requireRoles(...adminRoles));
settingsRoutes.get("/", getSettings);
settingsRoutes.put("/", updateSettings);
