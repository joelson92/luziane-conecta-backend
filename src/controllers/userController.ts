import bcrypt from "bcryptjs";
import { CitizenActivity, Demand, Event, Survey, User } from "../models/index.js";
import { enrichUserAddress } from "../services/geocodingService.js";
import { citizenRoleFilter, getCitizenGeoStats, normalizeUserCoordinates, validUserCoordinateQuery } from "../services/userGeoService.js";
import { asyncHandler, AppError } from "../utils/http.js";

const safeSelect = "-passwordHash -refreshTokenHash";

export const listUsers = asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {};
  if (req.query.role) query.role = normalizeRole(String(req.query.role));
  if (req.query.status === "active") query.isActive = true;
  if (req.query.status === "inactive") query.isActive = false;
  if (req.query.neighborhood) query.neighborhood = req.query.neighborhood;
  if (req.query.community) query.community = req.query.community;

  if (req.query.search) {
    const search = new RegExp(String(req.query.search), "i");
    query.$or = [{ name: search }, { email: search }, { phone: search }];
  }

  const data = await User.find(query).select(safeSelect).sort({ createdAt: -1 }).limit(500);
  res.json({ data });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(safeSelect);
  if (!user) throw new AppError(404, "User not found");
  res.json({ data: user });
});

export const createUser = asyncHandler(async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password || "User@123456", 12);
  const payload = normalizeUserCoordinates(await enrichUserAddress({ ...req.body, role: normalizeRole(req.body.role || "CIDADAO"), passwordHash }));
  const user = await User.create(payload);
  const safe = await User.findById(user._id).select(safeSelect);
  res.status(201).json({ data: safe });
});

export const updateUser = asyncHandler(async (req, res) => {
  const payload = normalizeUserCoordinates(await enrichUserAddress({ ...req.body, role: req.body.role ? normalizeRole(req.body.role) : undefined }));
  delete payload.passwordHash;
  delete payload.refreshTokenHash;
  const user = await User.findByIdAndUpdate(req.params.id, compact(payload), { new: true }).select(safeSelect);
  if (!user) throw new AppError(404, "User not found");
  res.json({ data: user });
});

export const softDeleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select(safeSelect);
  if (!user) throw new AppError(404, "User not found");
  res.json({ data: user });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body.isActive) }, { new: true }).select(safeSelect);
  if (!user) throw new AppError(404, "User not found");
  res.json({ data: user });
});

export const usersOverview = asyncHandler(async (_req, res) => {
  const [totalUsers, citizens, activeUsers, citizenGeoStats, neighborhoods] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: citizenRoleFilter }),
    User.countDocuments({ isActive: true }),
    getCitizenGeoStats(),
    User.distinct("neighborhood", validUserCoordinateQuery({ neighborhood: { $nin: [null, ""] } }))
  ]);
  const stats = {
    totalUsers,
    citizens,
    activeUsers,
    inactiveUsers: Math.max(totalUsers - activeUsers, 0),
    geolocatedUsers: citizenGeoStats.geolocatedCitizens,
    citizenGeolocatedUsers: citizenGeoStats.geolocatedCitizens,
    citizenUsersWithoutGeo: citizenGeoStats.withoutGeo,
    neighborhoodsWithUsers: neighborhoods.length
  };
  console.log("[USER_STATS]", stats);
  res.json(stats);
});

export const usersByNeighborhood = asyncHandler(async (_req, res) => {
  const data = await User.aggregate([
    { $group: { _id: "$neighborhood", total: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } },
    { $sort: { total: -1 } }
  ]);
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
  if (!user) throw new AppError(404, "User not found");

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

function engagementScore(input: { demands: number; events: number; surveys: number; points: number; lastLoginAt?: Date }) {
  const recent = input.lastLoginAt ? Date.now() - new Date(input.lastLoginAt).getTime() < 30 * 24 * 60 * 60 * 1000 : false;
  const score = input.demands * 10 + input.events * 15 + input.surveys * 10 + input.points + (recent ? 25 : 0);
  if (score >= 180) return { label: "Muito alto", score };
  if (score >= 90) return { label: "Alto", score };
  if (score >= 35) return { label: "Medio", score };
  return { label: "Baixo", score };
}

function normalizeRole(role: string) {
  const map: Record<string, string> = {
    superadmin: "SUPER_ADMIN",
    mayor: "PREFEITA",
    advisor: "ASSESSOR",
    citizen: "CIDADAO"
  };
  return map[role.toLowerCase()] ?? role;
}

function compact(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
