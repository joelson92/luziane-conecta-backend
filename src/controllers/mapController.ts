import { Demand, Event, Neighborhood, User } from "../models/index.js";
import { geocodeAddress } from "../services/geocodingService.js";
import { getCitizenGeoStats, validUserCoordinateQuery } from "../services/userGeoService.js";
import { asyncHandler, AppError } from "../utils/http.js";

export const mapUsers = asyncHandler(async (req, res) => {
  const extra: Record<string, unknown> = {};
  if (req.query.neighborhood) extra.neighborhood = req.query.neighborhood;
  const query = validUserCoordinateQuery(extra);
  const users = await User.find(query).select("name neighborhood community latitude longitude createdAt").limit(1000);
  const data = users.map((user) => ({
    id: user._id,
    name: user.get("name"),
    role: "CIDADAO",
    neighborhood: user.get("neighborhood"),
    community: user.get("community"),
    latitude: user.get("latitude"),
    longitude: user.get("longitude"),
    createdAt: user.get("createdAt")
  }));
  console.log("[MAP_USERS_COUNT]", data.length);
  res.json({ data });
});

export const mapUserStats = asyncHandler(async (req, res) => {
  const extra: Record<string, unknown> = {};
  if (req.query.neighborhood) extra.neighborhood = req.query.neighborhood;
  const stats = await getCitizenGeoStats(extra);
  console.log("[MAP_USERS_WITHOUT_GEO]", stats.withoutGeo);
  res.json({ data: { geolocated: stats.geolocatedCitizens, withoutCoordinates: stats.withoutGeo } });
});

export const mapDemands = asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {
    "location.lat": { $type: "number" },
    "location.lng": { $type: "number" }
  };
  if (req.query.neighborhood) query.neighborhood = req.query.neighborhood;
  const data = await Demand.find(query).select("type title status neighborhood community location createdAt").limit(1000);
  res.json({ data });
});

export const mapEvents = asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = { "location.lat": { $type: "number" }, "location.lng": { $type: "number" }, isPublished: true };
  if (req.query.neighborhood) query.neighborhood = req.query.neighborhood;
  const data = await Event.find(query).select("title neighborhood location startDate").limit(1000);
  res.json({ data });
});

export const mapHeatmap = asyncHandler(async (req, res) => {
  const userExtra: Record<string, unknown> = {};
  const demandQuery: Record<string, unknown> = {
    "location.lat": { $type: "number" },
    "location.lng": { $type: "number" }
  };
  if (req.query.neighborhood) {
    userExtra.neighborhood = req.query.neighborhood;
    demandQuery.neighborhood = req.query.neighborhood;
  }
  const [users, demands] = await Promise.all([
    User.find(validUserCoordinateQuery(userExtra)).select("latitude longitude"),
    Demand.find(demandQuery).select("type status location")
  ]);
  const data = [
    ...users.map((user) => ({ lat: user.get("latitude"), lng: user.get("longitude"), weight: 1, type: "user" })),
    ...demands.map((demand) => ({
      lat: demand.get("location.lat"),
      lng: demand.get("location.lng"),
      weight: demand.get("type") === "RECLAMACAO" || demand.get("status") !== "RESOLVIDO" ? 3 : 2,
      type: "demand"
    }))
  ];
  res.json({ data });
});

export const mapNeighborhoods = asyncHandler(async (_req, res) => {
  const data = await Neighborhood.find({ isActive: true }).sort({ name: 1 });
  res.json({ data });
});

export const geocodeAddressEndpoint = asyncHandler(async (req, res) => {
  const result = await geocodeAddress(req.body);
  if (!result) throw new AppError(404, "Address could not be geocoded");
  res.json({ data: result });
});
