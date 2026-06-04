import { Router } from "express";
import { cepTest } from "../controllers/debugController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";

export const debugRoutes = Router();

debugRoutes.use(requireAuth, requireRoles(...adminRoles));
debugRoutes.post("/cep-test", cepTest);
