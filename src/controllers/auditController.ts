import { Demand, Event, Neighborhood, User } from "../models/index.js";
import { citizenRoleFilter } from "../services/userGeoService.js";
import { asyncHandler } from "../utils/http.js";
import { normalizeNeighborhoodName } from "../utils/neighborhood.js";

export const auditNeighborhoods = asyncHandler(async (_req, res) => {
  const [neighborhoods, userNeighborhoodsRaw, usersWithoutNeighborhoodId, demandsWithoutNeighborhoodId, eventsWithoutNeighborhoodId, users, demands, events] = await Promise.all([
    Neighborhood.find().select("name normalizedName isActive").sort({ name: 1 }),
    User.distinct("neighborhood", { role: citizenRoleFilter }),
    User.countDocuments({ role: citizenRoleFilter, neighborhood: { $nin: [null, ""] }, $or: [{ neighborhoodId: { $exists: false } }, { neighborhoodId: null }] }),
    Demand.countDocuments({ neighborhood: { $nin: [null, ""] }, $or: [{ neighborhoodId: { $exists: false } }, { neighborhoodId: null }] }),
    Event.countDocuments({ neighborhood: { $nin: [null, ""] }, $or: [{ neighborhoodId: { $exists: false } }, { neighborhoodId: null }] }),
    User.find({ role: citizenRoleFilter }).select("neighborhood neighborhoodName neighborhoodId").limit(5000),
    Demand.find().select("neighborhood neighborhoodName neighborhoodId").limit(5000),
    Event.find().select("neighborhood neighborhoodName neighborhoodId").limit(5000)
  ]);

  const registered = new Map(neighborhoods.map((item) => [normalizeNeighborhoodName(item.get("name")), item]));
  const inconsistentNames = collectInconsistencies([...users, ...demands, ...events], registered);
  const suggestedFixes = inconsistentNames.map((name) => ({
    rawName: name,
    normalizedName: normalizeNeighborhoodName(name),
    action: registered.has(normalizeNeighborhoodName(name)) ? "vincular ao bairro existente" : "criar bairro e vincular registros"
  }));

  res.json({
    neighborhoodsRegistered: neighborhoods.map((item) => ({
      id: item._id,
      name: item.get("name"),
      normalizedName: item.get("normalizedName"),
      isActive: item.get("isActive")
    })),
    userNeighborhoodsRaw,
    usersWithoutNeighborhoodId,
    demandsWithoutNeighborhoodId,
    eventsWithoutNeighborhoodId,
    inconsistentNames,
    suggestedFixes
  });
});

function collectInconsistencies(records: any[], registered: Map<string, unknown>) {
  const names = new Set<string>();
  for (const record of records) {
    if (record.get("neighborhoodId")) continue;
    const name = record.get("neighborhoodName") || record.get("neighborhood");
    if (!name) continue;
    const normalized = normalizeNeighborhoodName(name);
    if (!normalized || registered.has(normalized)) continue;
    names.add(String(name));
  }
  return Array.from(names).sort();
}
