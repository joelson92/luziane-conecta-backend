import { Router } from "express";
import { acceptConsent, acceptConsentSchema, deleteMyAccount, forgotPassword, forgotPasswordSchema, login, loginSchema, me, refresh, register, registerSchema, resetPassword, resetPasswordSchema } from "../controllers/authController.js";
import { updateMyPushToken } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), register);
authRoutes.post("/login", validate(loginSchema), login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
authRoutes.post("/reset-password", validate(resetPasswordSchema), resetPassword);
authRoutes.get("/me", requireAuth, me);
authRoutes.post("/consent", requireAuth, validate(acceptConsentSchema), acceptConsent);
authRoutes.delete("/me", requireAuth, deleteMyAccount);
authRoutes.patch("/me/push-token", requireAuth, updateMyPushToken);

