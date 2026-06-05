import { Demand, Event, User } from "../models/index.js";
import { geocodeAddress } from "../services/geocodingService.js";
import { getCitizenGeoStats, getConfirmedMapUsers } from "../services/userGeoService.js";
import { asyncHandler, AppError } from "../utils/http.js";
// ─── Map Users ─────────────────────────────────────────────────────────────────
export const mapUsers = asyncHandler(async (_req, res) => {
    const mapUsers_ = await getConfirmedMapUsers();
    const data = mapUsers_.map((user) => ({
        id: user._id,
        name: user.name,
        role: user.role,
        neighborhoodName: (user.neighborhoodName ?? user.neighborhood ?? ""),
        city: user.city ?? "",
        state: user.state ?? "",
        street: user.street ?? "",
        number: user.number ?? "",
        community: user.community ?? "",
        latitude: user.latitude,
        longitude: user.longitude,
        // Normalise: if lat/lng exist, treat as confirmed (handles legacy records)
        locationConfirmed: user.locationConfirmed ?? true,
        locationSource: user.locationSource ?? "MANUAL_PIN"
    }));
    console.log("[MAP_USERS_API_RESPONSE] count:", data.length);
    res.json(data);
});
// ─── Map Summary ───────────────────────────────────────────────────────────────
export const mapSummary = asyncHandler(async (_req, res) => {
    // geolocatedUsers = ALL active users with valid lat/lng (any role)
    const confirmedUsers = await getConfirmedMapUsers();
    const geolocatedCitizens = confirmedUsers.length;
    // Total active users (all roles)
    const totalActiveUsers = await User.countDocuments({ isActive: true });
    const citizensWithoutCoordinates = Math.max(totalActiveUsers - geolocatedCitizens, 0);
    // Distinct neighborhoods
    const neighborhoodNames = new Set();
    for (const u of confirmedUsers) {
        const n = u.neighborhoodName || u.neighborhood || "";
        if (n.trim())
            neighborhoodNames.add(n.trim());
    }
    // Distinct municipalities
    const cityNames = new Set();
    for (const u of confirmedUsers) {
        if (u.city?.trim())
            cityNames.add(u.city.trim());
    }
    res.json({
        geolocatedCitizens,
        citizensWithoutCoordinates,
        activeNeighborhoods: neighborhoodNames.size,
        municipalitiesWithUsers: cityNames.size
    });
});
// ─── Map Neighborhoods ─────────────────────────────────────────────────────────
// Source: ONLY confirmed geolocated citizens. No Neighborhood collection. No seed.
export const mapNeighborhoods = asyncHandler(async (_req, res) => {
    const users_ = await getConfirmedMapUsers();
    const groups = new Map();
    for (const user of users_) {
        const rawName = (user.neighborhoodName || user.neighborhood || "").trim();
        if (!rawName)
            continue;
        const key = rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!groups.has(key)) {
            groups.set(key, { name: rawName, city: user.city?.trim() ?? "" });
        }
    }
    const neighborhoods = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    console.log("[MAP_NEIGHBORHOODS_FROM_USERS]", neighborhoods);
    res.json(neighborhoods);
});
/**
 * GET /api/map/neighborhoods-stats
 * Retorna bairros com contagens detalhadas — fonte única: coleção User.
 * Sem Neighborhood collection. Sem dados fixos.
 */
export const mapNeighborhoodStats = asyncHandler(async (_req, res) => {
    const result = await User.aggregate([
        {
            $match: {
                isActive: true,
                $or: [
                    { neighborhood: { $exists: true, $nin: [null, ""] } },
                    { neighborhoodName: { $exists: true, $nin: [null, ""] } }
                ]
            }
        },
        {
            $group: {
                _id: { $ifNull: ["$neighborhoodName", "$neighborhood"] },
                totalUsers: { $sum: 1 },
                geolocatedUsers: {
                    $sum: {
                        $cond: [
                            { $and: [{ $isNumber: "$latitude" }, { $isNumber: "$longitude" }] },
                            1,
                            0
                        ]
                    }
                },
                city: { $first: "$city" },
                state: { $first: "$state" }
            }
        },
        {
            $project: {
                _id: 0,
                name: "$_id",
                totalUsers: 1,
                geolocatedUsers: 1,
                city: 1,
                state: 1
            }
        },
        { $match: { name: { $nin: [null, ""] } } },
        { $sort: { totalUsers: -1 } }
    ]);
    res.json(result);
});
// ─── Map Heatmap ───────────────────────────────────────────────────────────────
export const mapHeatmap = asyncHandler(async (req, res) => {
    const confirmedUsers = await getConfirmedMapUsers();
    const demandQuery = {
        "location.lat": { $type: "number" },
        "location.lng": { $type: "number" }
    };
    if (req.query.city)
        demandQuery.city = req.query.city;
    if (req.query.neighborhoodName)
        demandQuery.neighborhoodName = req.query.neighborhoodName;
    if (req.query.neighborhoodId)
        demandQuery.neighborhoodId = req.query.neighborhoodId;
    const demands = await Demand.find(demandQuery).select("type status location city").lean();
    const data = [
        ...confirmedUsers.map((user) => ({
            lat: user.latitude,
            lng: user.longitude,
            weight: 1,
            type: "USER",
            neighborhoodName: user.neighborhoodName ?? user.neighborhood ?? "",
            city: user.city ?? ""
        })),
        ...demands.map((demand) => ({
            lat: demand.location?.lat,
            lng: demand.location?.lng,
            weight: demand.type === "RECLAMACAO" || demand.status !== "RESOLVIDO" ? 3 : 2,
            type: "demand",
            city: demand.city ?? ""
        }))
    ];
    res.json({ data });
});
// ─── Passthrough endpoints (unchanged behaviour) ───────────────────────────────
export const mapDemands = asyncHandler(async (req, res) => {
    const query = {
        "location.lat": { $type: "number" },
        "location.lng": { $type: "number" }
    };
    if (req.query.city)
        query.city = req.query.city;
    if (req.query.neighborhoodName)
        query.neighborhoodName = req.query.neighborhoodName;
    if (req.query.neighborhoodId)
        query.neighborhoodId = req.query.neighborhoodId;
    const data = await Demand.find(query)
        .select("type title status neighborhoodId neighborhoodName neighborhood community location city state createdAt")
        .limit(1000);
    res.json({ data });
});
export const mapEvents = asyncHandler(async (req, res) => {
    const query = {
        "location.lat": { $type: "number" },
        "location.lng": { $type: "number" },
        isPublished: true
    };
    if (req.query.neighborhoodName)
        query.neighborhoodName = req.query.neighborhoodName;
    if (req.query.neighborhoodId)
        query.neighborhoodId = req.query.neighborhoodId;
    const data = await Event.find(query)
        .select("title neighborhoodId neighborhoodName neighborhood location startDate")
        .limit(1000);
    res.json({ data });
});
export const mapUserStats = asyncHandler(async (req, res) => {
    const extra = {};
    if (req.query.city)
        extra.city = req.query.city;
    if (req.query.neighborhoodName)
        extra.neighborhoodName = req.query.neighborhoodName;
    if (req.query.neighborhoodId)
        extra.neighborhoodId = req.query.neighborhoodId;
    const stats = await getCitizenGeoStats(extra);
    res.json({ data: { geolocated: stats.geolocatedCitizens, withoutCoordinates: stats.withoutGeo } });
});
export const geocodeAddressEndpoint = asyncHandler(async (req, res) => {
    const result = await geocodeAddress(req.body);
    if (!result)
        throw new AppError(404, "Address could not be geocoded");
    res.json({ data: result });
});
// ─── Dados dinâmicos para filtros da Central de Notificações ──────────────────
// Fonte única: coleção User. Sem cadastros manuais.
/** GET /api/map/communities — lista dinâmica de comunidades dos usuários ativos */
export const mapCommunities = asyncHandler(async (_req, res) => {
    const communities = await User.distinct("community", {
        isActive: true,
        community: { $nin: [null, ""] }
    });
    const sorted = communities
        .map((c) => String(c).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    res.json(sorted);
});
/** GET /api/map/interests — lista dinâmica de interesses dos usuários ativos */
export const mapInterests = asyncHandler(async (_req, res) => {
    const result = await User.aggregate([
        { $match: { isActive: true, interests: { $exists: true, $not: { $size: 0 } } } },
        { $unwind: "$interests" },
        { $match: { interests: { $nin: [null, ""] } } },
        { $group: { _id: "$interests" } },
        { $sort: { _id: 1 } }
    ]);
    res.json(result.map((item) => item._id).filter(Boolean));
});
/** GET /api/map/profiles — lista dinâmica de perfis dos usuários ativos */
export const mapProfiles = asyncHandler(async (_req, res) => {
    const profiles = await User.distinct("profile", {
        isActive: true,
        profile: { $nin: [null, ""] }
    });
    const sorted = profiles
        .map((p) => String(p).trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    res.json(sorted);
});
