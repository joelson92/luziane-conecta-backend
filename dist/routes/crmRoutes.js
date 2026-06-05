import { Router } from "express";
import { citizenProfile } from "../controllers/crmController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
export const crmRoutes = Router();
crmRoutes.get("/citizens/:userId", requireAuth, requireRoles(...adminRoles), citizenProfile);
