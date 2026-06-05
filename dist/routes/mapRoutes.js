import { Router } from "express";
import { geocodeAddressEndpoint, mapCommunities, mapDemands, mapEvents, mapHeatmap, mapInterests, mapNeighborhoods, mapNeighborhoodStats, mapProfiles, mapUsers, mapUserStats, mapSummary } from "../controllers/mapController.js";
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
// ─── Rotas dinâmicas para filtros da Central de Notificações ─────────────────
// Dados extraídos diretamente da coleção User — sem cadastros manuais
mapRoutes.get("/communities", mapCommunities);
mapRoutes.get("/interests", mapInterests);
mapRoutes.get("/profiles", mapProfiles);
// ─── Estatísticas de bairros derivadas de User (fonte única da verdade) ───────
mapRoutes.get("/neighborhoods-stats", mapNeighborhoodStats);
