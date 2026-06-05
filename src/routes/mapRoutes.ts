import { Router } from "express";
import { geocodeAddressEndpoint, mapDemands, mapEvents, mapHeatmap, mapNeighborhoods, mapUsers, mapUserStats, mapSummary } from "../controllers/mapController.js";
import { adminRoles, requireAuth, requireRoles } from "../middleware/auth.js";

export const mapRoutes = Router();

mapRoutes.use(requireAuth, requireRoles(...adminRoles));
mapRoutes.get("/users", mapUsers);
mapRoutes.get("/users/stats", mapUserStats);
mapRoutes.get("/summary", mapSummary);
mapRoutes.get("/demands", mapDemands);
mapRoutes.get("/events", mapEvents);
mapRoutes.get("/heatmap", mapHeatmap);
mapRoutes.get("/neighborhoods", mapNeighborhoods);
mapRoutes.post("/geocode-address", geocodeAddressEndpoint);
