import { Router } from "express";
import { login, loginSchema, me, refresh, register, registerSchema } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
export const authRoutes = Router();
authRoutes.post("/register", validate(registerSchema), register);
authRoutes.post("/login", validate(loginSchema), login);
authRoutes.post("/refresh", refresh);
authRoutes.get("/me", requireAuth, me);
