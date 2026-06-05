import { Router } from "express";
import { adoption, dashboard, intelligence } from "../controllers/dashboardController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
export const dashboardRoutes = Router();
dashboardRoutes.use(requireAuth, requireRoles(...adminRoles));
dashboardRoutes.get("/", dashboard);
dashboardRoutes.get("/adoption", adoption);
dashboardRoutes.get("/intelligence", intelligence);
