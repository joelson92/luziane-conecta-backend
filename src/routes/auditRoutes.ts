import { Router } from "express";
import { auditNeighborhoods } from "../controllers/auditController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";

export const auditRoutes = Router();

auditRoutes.use(requireAuth, requireRoles(...adminRoles));
auditRoutes.get("/neighborhoods", auditNeighborhoods);
