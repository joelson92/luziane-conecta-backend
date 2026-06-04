import { Router } from "express";
import { createContact, listContactMessages, contactSchema } from "../controllers/publicController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

export const publicRoutes = Router();

publicRoutes.post("/contact", validate(contactSchema), createContact("CONTACT"));
publicRoutes.post("/ouvidoria", validate(contactSchema), createContact("OUVIDORIA"));
publicRoutes.get("/messages", requireAuth, requireRoles(...adminRoles), listContactMessages);
