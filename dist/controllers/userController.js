import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { CitizenActivity, Demand, Event, Survey, User, Neighborhood } from "../models/index.js";
import { buildNeighborhoodQuery, stripEmptyNeighborhoodId } from "../services/neighborhoodService.js";
import { citizenRoleFilter, getCitizenGeoStats, normalizeUserCoordinates } from "../services/userGeoService.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { normalizeNeighborhoodName } from "../utils/neighborhood.js";
const safeSelect = "-passwordHash -refreshTokenHash";
export const listUsers = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.role)
        query.role = normalizeRole(String(req.query.role));
    if (req.query.status === "active")
        query.isActive = true;
    if (req.query.status === "inactive")
        query.isActive = false;
    Object.assign(query, await buildNeighborhoodQuery({ neighborhoodId: req.query.neighborhoodId, neighborhood: req.query.neighborhood }));
    if (req.query.community)
        query.community = req.query.community;
    if (req.query.search) {
        const search = new RegExp(String(req.query.search), "i");
        query.$or = [{ name: search }, { email: search }, { phone: search }];
    }
    const data = await User.find(query).select(safeSelect).sort({ createdAt: -1 }).limit(500);
    res.json({ data });
});
export const getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select(safeSelect);
    if (!user)
        throw new AppError(404, "User not found");
    res.json({ data: user });
});
export const createUser = asyncHandler(async (req, res) => {
    console.log("[USER_RAW_BODY]", req.body);
    const passwordHash = await bcrypt.hash(req.body.password || "User@123456", 12);
    const payload = normalizeUserCoordinates(await prepareUserPayload(sanitizeUserPayload({ ...req.body, role: normalizeRole(req.body.role || "CIDADAO"), passwordHash }), true));
    const user = await User.create(payload);
    const safe = await User.findById(user._id).select(safeSelect);
    res.status(201).json({ data: safe });
});
export const updateUser = asyncHandler(async (req, res) => {
    console.log("[USER_RAW_BODY]", req.body);
    const user = await User.findById(req.params.id);
    if (!user)
        throw new AppError(404, "User not found");
    const cepChanged = user.zipCode !== req.body.zipCode;
    const addressChanged = user.zipCode !== req.body.zipCode ||
        user.street !== req.body.street ||
        user.number !== req.body.number ||
        user.neighborhoodName !== req.body.neighborhoodName ||
        user.city !== req.body.city ||
        user.state !== req.body.state;
    const oldUserAddress = {
        zipCode: user.zipCode,
        street: user.street,
        number: user.number,
        neighborhoodName: user.neighborhoodName,
        city: user.city,
        state: user.state
    };
    const newAddress = {
        zipCode: req.body.zipCode,
        street: req.body.street,
        number: req.body.number,
        neighborhoodName: req.body.neighborhoodName,
        city: req.body.city,
        state: req.body.state
    };
    console.log("[USER_ADDRESS_CHANGED]", addressChanged);
    console.log("[OLD_ADDRESS]", oldUserAddress);
    console.log("[NEW_ADDRESS]", newAddress);
    if (cepChanged) {
        console.log("[RECALCULATING_GEOCODING]");
        req.body.latitude = undefined;
        req.body.longitude = undefined;
        req.body.geocodingStatus = undefined;
        delete req.body.neighborhoodId;
        if (req.body.address) {
            delete req.body.address.neighborhoodId;
        }
    }
    const payload = normalizeUserCoordinates(await prepareUserPayload(sanitizeUserPayload({ ...req.body, role: req.body.role ? normalizeRole(req.body.role) : undefined }), cepChanged, user));
    delete payload.passwordHash;
    delete payload.refreshTokenHash;
    const updatedUser = await User.findByIdAndUpdate(req.params.id, compact(payload), { new: true }).select(safeSelect);
    res.json({ data: updatedUser });
});
export const softDeleteUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select(safeSelect);
    if (!user)
        throw new AppError(404, "User not found");
    res.json({ data: user });
});
export const updateUserStatus = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body.isActive) }, { new: true }).select(safeSelect);
    if (!user)
        throw new AppError(404, "User not found");
    res.json({ data: user });
});
export const usersOverview = asyncHandler(async (_req, res) => {
    const [totalUsers, citizens, activeUsers, citizenGeoStats, neighborhoodsWithUsers, usersWithoutNeighborhoodId, usersByNeighborhoodResult] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: citizenRoleFilter }),
        User.countDocuments({ isActive: true }),
        getCitizenGeoStats(),
        countCitizenNeighborhoods(),
        User.countDocuments({ role: citizenRoleFilter, $or: [{ neighborhoodId: { $exists: false } }, { neighborhoodId: null }] }),
        usersByNeighborhoodAggregation()
    ]);
    const stats = {
        totalUsers,
        citizens,
        activeUsers,
        inactiveUsers: Math.max(totalUsers - activeUsers, 0),
        geolocatedUsers: citizenGeoStats.geolocatedCitizens,
        citizenGeolocatedUsers: citizenGeoStats.geolocatedCitizens,
        citizenUsersWithoutGeo: citizenGeoStats.withoutGeo,
        neighborhoodsWithUsers
    };
    console.log("[USER_STATS]", stats);
    console.log("[USERS_WITHOUT_NEIGHBORHOOD_ID]", usersWithoutNeighborhoodId);
    console.log("[USERS_BY_NEIGHBORHOOD]", usersByNeighborhoodResult);
    res.json(stats);
});
export const usersByNeighborhood = asyncHandler(async (_req, res) => {
    const data = await usersByNeighborhoodAggregation();
    res.json({ data: data.map((item) => ({ neighborhood: item._id || "Nao informado", total: item.total, active: item.active })) });
});
export const userActivity = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const [user, openDemands, resolvedDemands, events, surveys, activities] = await Promise.all([
        User.findById(userId).select(safeSelect),
        Demand.find({ citizenId: userId, status: { $ne: "RESOLVIDO" } }).sort({ createdAt: -1 }),
        Demand.find({ citizenId: userId, status: "RESOLVIDO" }).sort({ createdAt: -1 }),
        Event.find({ attendees: userId }).sort({ startDate: -1 }),
        Survey.find({ "options.votes": userId }).sort({ createdAt: -1 }),
        CitizenActivity.find({ userId }).sort({ createdAt: -1 })
    ]);
    if (!user)
        throw new AppError(404, "User not found");
    const score = engagementScore({
        demands: openDemands.length + resolvedDemands.length,
        events: events.length,
        surveys: surveys.length,
        points: Number(user.get("points") ?? 0),
        lastLoginAt: user.get("lastLoginAt") ?? undefined
    });
    res.json({
        user,
        engagement: score,
        openDemands,
        resolvedDemands,
        events,
        surveys,
        viewedPosts: [],
        activities
    });
});
function engagementScore(input) {
    const recent = input.lastLoginAt ? Date.now() - new Date(input.lastLoginAt).getTime() < 30 * 24 * 60 * 60 * 1000 : false;
    const score = input.demands * 10 + input.events * 15 + input.surveys * 10 + input.points + (recent ? 25 : 0);
    if (score >= 180)
        return { label: "Muito alto", score };
    if (score >= 90)
        return { label: "Alto", score };
    if (score >= 35)
        return { label: "Medio", score };
    return { label: "Baixo", score };
}
function normalizeRole(role) {
    const map = {
        superadmin: "SUPER_ADMIN",
        mayor: "PREFEITA",
        advisor: "ASSESSOR",
        citizen: "CIDADAO"
    };
    return map[role.toLowerCase()] ?? role;
}
function compact(payload) {
    const sanitized = sanitizeUserPayload(stripEmptyNeighborhoodId(payload));
    return Object.fromEntries(Object.entries(sanitized).filter(([, value]) => value !== undefined && value !== ""));
}
async function prepareUserPayload(payload, cepChanged, originalUser) {
    const sanitized = sanitizeUserPayload(stripEmptyNeighborhoodId(payload));
    console.log("[USER_SANITIZED_BODY]", sanitized);
    // Normalize coordinates first to check if they are present
    const normalized = normalizeUserCoordinates(sanitized);
    if (typeof normalized.latitude === "number" && typeof normalized.longitude === "number") {
        sanitized.latitude = normalized.latitude;
        sanitized.longitude = normalized.longitude;
        sanitized.locationConfirmed = true;
        sanitized.locationSource = "MANUAL_PIN";
        sanitized.locationConfirmedAt = new Date();
        sanitized.geocodingStatus = "SUCCESS";
        sanitized.geocodingPrecision = "MANUAL";
    }
    else {
        // If not supplied, keep original or default
        sanitized.locationConfirmed = payload.locationConfirmed ?? false;
        sanitized.locationSource = payload.locationSource || undefined;
        sanitized.locationConfirmedAt = payload.locationConfirmedAt || originalUser?.locationConfirmedAt || undefined;
    }
    validateUserAddress(sanitized);
    // Check neighborhood if it matches official active neighborhood, but do not block
    const neighborhoodName = sanitized.neighborhoodName || sanitized.neighborhood;
    if (neighborhoodName) {
        const normName = normalizeNeighborhoodName(neighborhoodName);
        const matchedNeighborhood = await Neighborhood.findOne({ normalizedName: normName, isActive: true });
        if (matchedNeighborhood) {
            sanitized.neighborhoodId = matchedNeighborhood._id;
            sanitized.neighborhoodName = matchedNeighborhood.get("name");
            sanitized.neighborhood = matchedNeighborhood.get("name");
        }
        else {
            sanitized.neighborhoodId = undefined;
            sanitized.neighborhoodName = neighborhoodName.trim();
            sanitized.neighborhood = neighborhoodName.trim();
        }
    }
    return sanitizeUserPayload(sanitized);
}
function validateUserAddress(data) {
    if (!data.city || !data.state) {
        throw new AppError(400, "Selecione o município.");
    }
    if (!data.street || (!data.neighborhoodName && !data.neighborhood) || !data.number) {
        throw new AppError(400, "Preencha rua, bairro, cidade, estado e número para salvar o usuário.");
    }
    // Only require coordinates for citizens
    const isCitizen = data.role === "CIDADAO" || data.role === "citizen";
    if (isCitizen) {
        if (data.latitude === undefined || data.latitude === null || data.longitude === undefined || data.longitude === null || !data.locationConfirmed) {
            throw new AppError(400, "Selecione a localização no mapa antes de salvar.");
        }
    }
}
function sanitizeUserPayload(data) {
    const next = { ...data };
    sanitizeNeighborhoodId(next);
    if (next.address) {
        next.address = { ...next.address };
        sanitizeNeighborhoodId(next.address);
    }
    return next;
}
function sanitizeNeighborhoodId(data) {
    const value = data.neighborhoodId;
    if (!value || value === "" || value === "undefined" || value === "null") {
        delete data.neighborhoodId;
        return;
    }
    if (value instanceof mongoose.Types.ObjectId)
        return;
    if (typeof value !== "string" || !mongoose.Types.ObjectId.isValid(value))
        delete data.neighborhoodId;
}
async function countCitizenNeighborhoods() {
    const rows = await User.aggregate([
        { $match: { role: citizenRoleFilter } },
        {
            $group: {
                _id: {
                    id: "$neighborhoodId",
                    name: { $ifNull: ["$neighborhoodName", "$neighborhood"] }
                }
            }
        },
        {
            $match: {
                $or: [{ "_id.id": { $ne: null } }, { "_id.name": { $nin: [null, ""] } }]
            }
        }
    ]);
    return rows.length;
}
async function usersByNeighborhoodAggregation() {
    return User.aggregate([
        { $match: { role: citizenRoleFilter } },
        {
            $group: {
                _id: { $ifNull: ["$neighborhoodName", "$neighborhood"] },
                total: { $sum: 1 },
                active: { $sum: { $cond: ["$isActive", 1, 0] } }
            }
        },
        { $sort: { total: -1 } }
    ]);
}
