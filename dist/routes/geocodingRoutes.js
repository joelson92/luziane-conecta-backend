import { Router } from "express";
import { lookupAddress, lookupCep, searchAddress, resolveAddress } from "../controllers/geocodingController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";
export const geocodingRoutes = Router();
geocodingRoutes.use(requireAuth, requireRoles(...adminRoles));
geocodingRoutes.post("/cep", lookupCep);
geocodingRoutes.post("/address", lookupAddress);
geocodingRoutes.get("/search-address", searchAddress);
geocodingRoutes.post("/resolve-address", resolveAddress);
