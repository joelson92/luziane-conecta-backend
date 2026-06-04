import { Router } from "express";
import { getUploadUrl, removeUpload, uploadRequestSchema } from "../controllers/uploadController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
export const uploadRoutes = Router();
uploadRoutes.post("/signed-url", requireAuth, validate(uploadRequestSchema), getUploadUrl);
uploadRoutes.delete("/", requireAuth, requireRoles(...adminRoles), removeUpload);
