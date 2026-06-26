import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getBirthdayBanner, trackBirthdayBannerView } from "../controllers/birthdayBannerController.js";

export const meRoutes = Router();

meRoutes.get("/birthday-banner", requireAuth, getBirthdayBanner);
meRoutes.post("/birthday-banner/view", requireAuth, trackBirthdayBannerView);
