import { Router } from "express";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { listBirthdays, congratulate, runAutomation } from "../controllers/birthdayController.js";

export const birthdayRoutes = Router();

birthdayRoutes.use(requireAuth, requireRoles("SUPER_ADMIN", "PREFEITA", "ASSESSOR"));

birthdayRoutes.get("/month", listBirthdays);
birthdayRoutes.post("/congratulate", congratulate);
birthdayRoutes.post("/run-automation", requireRoles("SUPER_ADMIN"), runAutomation);
