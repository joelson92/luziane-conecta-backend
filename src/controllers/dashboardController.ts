import { CitizenActivity, Demand, Event, Neighborhood, Notification, Post, Survey, SystemSettings, User } from "../models/index.js";
import { asyncHandler } from "../utils/http.js";

export const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const lateThreshold = new Date(now);
  lateThreshold.setDate(now.getDate() - 7);
  const activeActivityUserIds = await CitizenActivity.distinct("userId", { createdAt: { $gte: thirtyDaysAgo } });
  const [
    users,
    activeUsers,
    citizenUsers,
    openDemands,
    resolvedDemands,
    lateDemands,
    events,
    surveys,
    notifications,
    usersByNeighborhood,
    demandEvolution,
    engagement,
    geolocatedUsers,
    geolocatedDemands,
    topParticipationNeighborhood,
    topComplaintNeighborhood,
    topDemandStreets,
    mostComplaintsNeighborhoods,
    activeNeighborhoods,
    recentDemands,
    posts,
    recentEvents,
    recentSurveys,
    recentNotifications,
    resolvedRecentDemands,
    mapUsers,
    mapDemands,
    mapEvents,
    heatmapUsers,
    heatmapDemands,
    topics
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({
      $or: [{ lastLoginAt: { $gte: thirtyDaysAgo } }, { _id: { $in: activeActivityUserIds } }]
    }),
    User.countDocuments({ role: "CIDADAO" }),
    Demand.countDocuments({ status: { $ne: "RESOLVIDO" } }),
    Demand.countDocuments({ status: "RESOLVIDO" }),
    Demand.countDocuments({ status: { $ne: "RESOLVIDO" }, createdAt: { $lt: lateThreshold } }),
    Event.countDocuments({ isPublished: true, startDate: { $gte: now } }),
    Survey.countDocuments({ isActive: true }),
    Notification.aggregate([{ $group: { _id: null, sent: { $sum: "$sentCount" } } }]),
    User.aggregate([{ $match: { role: "CIDADAO" } }, { $group: { _id: "$neighborhood", total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Demand.aggregate([
      {
        $group: {
          _id: { month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, status: "$status" },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]),
    CitizenActivity.aggregate([{ $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: 1 } } }]),
    User.countDocuments({ role: "CIDADAO", latitude: { $type: "number" }, longitude: { $type: "number" } }),
    Demand.countDocuments({ "location.lat": { $type: "number" }, "location.lng": { $type: "number" } }),
    User.aggregate([{ $match: { role: "CIDADAO", latitude: { $type: "number" } } }, { $group: { _id: "$neighborhood", total: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 1 }]),
    Demand.aggregate([{ $match: { type: "RECLAMACAO" } }, { $group: { _id: "$neighborhood", total: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 1 }]),
    Demand.aggregate([{ $match: { status: { $ne: "RESOLVIDO" } } }, { $group: { _id: "$address.street", total: { $sum: 1 } } }, { $match: { _id: { $ne: null } } }, { $sort: { total: -1 } }, { $limit: 5 }]),
    Demand.aggregate([{ $match: { type: "RECLAMACAO" } }, { $group: { _id: "$neighborhood", total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    neighborhoodActivityRanking(),
    Demand.find().sort({ createdAt: -1 }).limit(6).select("createdAt neighborhood title status assignedTo type"),
    Post.find({ isPublished: true }).sort({ publishedAt: -1, createdAt: -1 }).limit(5).select("title publishedAt createdAt"),
    Event.find({ isPublished: true }).sort({ createdAt: -1 }).limit(5).select("title createdAt"),
    Survey.find({ isActive: true }).sort({ createdAt: -1 }).limit(5).select("title createdAt"),
    Notification.find().sort({ createdAt: -1 }).limit(5).select("title createdAt"),
    Demand.find({ status: "RESOLVIDO" }).sort({ resolvedAt: -1, updatedAt: -1 }).limit(5).select("title resolvedAt updatedAt"),
    User.find({ role: "CIDADAO", latitude: { $type: "number" }, longitude: { $type: "number" } }).select("neighborhood community latitude longitude").limit(1000),
    Demand.find({ "location.lat": { $type: "number" }, "location.lng": { $type: "number" } }).select("title status neighborhood location").limit(1000),
    Event.find({ "location.lat": { $type: "number" }, "location.lng": { $type: "number" }, isPublished: true }).select("title neighborhood location startDate").limit(1000),
    User.find({ role: "CIDADAO", latitude: { $type: "number" }, longitude: { $type: "number" } }).select("latitude longitude"),
    Demand.find({ "location.lat": { $type: "number" }, "location.lng": { $type: "number" } }).select("location"),
    calculateMostMentionedTopics()
  ]);

  const demandEvolutionByMonth = normalizeDemandEvolution(demandEvolution);
  const result = {
    indicators: {
      users,
      activeUsers,
      citizenUsers,
      openDemands,
      resolvedDemands,
      lateDemands,
      activeEvents: events,
      activeSurveys: surveys,
      engagementRate: citizenUsers ? Math.round((activeUsers / citizenUsers) * 100) : 0,
      notificationsSent: notifications[0]?.sent ?? 0,
      geolocatedUsers,
      geolocatedDemands
    },
    territorial: {
      topParticipationNeighborhood: topParticipationNeighborhood[0] ?? null,
      topComplaintNeighborhood: topComplaintNeighborhood[0] ?? null,
      topDemandStreets
    },
    rankings: {
      activeNeighborhoods,
      complaintNeighborhoods: mostComplaintsNeighborhoods
    },
    topics,
    charts: {
      usersByNeighborhood,
      demandEvolution: demandEvolutionByMonth,
      engagement
    },
    recentDemands,
    activityTimeline: buildActivityTimeline({ posts, recentEvents, recentSurveys, recentNotifications, resolvedRecentDemands }),
    map: {
      users: mapUsers,
      demands: mapDemands,
      events: mapEvents,
      heatmap: [
        ...heatmapUsers.map((user) => ({ lat: user.get("latitude"), lng: user.get("longitude"), weight: 1, type: "user" })),
        ...heatmapDemands.map((demand) => ({ lat: demand.get("location.lat"), lng: demand.get("location.lng"), weight: 2, type: "demand" }))
      ]
    }
  };

  console.log("[DASHBOARD_QUERY_RESULT]", result);
  res.json(result);
});

export const intelligence = asyncHandler(async (_req, res) => {
  const [activeNeighborhoods, complaints, terms] = await Promise.all([
    CitizenActivity.aggregate([{ $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }, { $unwind: "$user" }, { $group: { _id: "$user.neighborhood", total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Demand.aggregate([{ $group: { _id: "$neighborhood", total: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Post.aggregate([{ $project: { words: { $split: ["$title", " "] } } }, { $unwind: "$words" }, { $group: { _id: "$words", total: { $sum: 1 } } }, { $sort: { total: -1 } }, { $limit: 25 }])
  ]);
  res.json({ activeNeighborhoods, neighborhoodsWithComplaints: complaints, wordCloud: terms });
});

export const adoption = asyncHandler(async (_req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeActivityUserIds = await CitizenActivity.distinct("userId", { createdAt: { $gte: thirtyDaysAgo } });

  const [
    totalUsers,
    activeUsers,
    usersToday,
    usersThisMonth,
    usersPreviousMonth,
    usersWithCoordinates,
    topNeighborhoods,
    registrationsByMonth,
    neighborhoods,
    settings
  ] = await Promise.all([
    User.countDocuments({ role: "CIDADAO" }),
    User.countDocuments({
      role: "CIDADAO",
      $or: [{ lastLoginAt: { $gte: thirtyDaysAgo } }, { _id: { $in: activeActivityUserIds } }]
    }),
    User.countDocuments({ role: "CIDADAO", createdAt: { $gte: startOfToday } }),
    User.countDocuments({ role: "CIDADAO", createdAt: { $gte: startOfMonth } }),
    User.countDocuments({ role: "CIDADAO", createdAt: { $gte: startOfPreviousMonth, $lt: endOfPreviousMonth } }),
    User.countDocuments({ role: "CIDADAO", latitude: { $type: "number" }, longitude: { $type: "number" } }),
    User.aggregate([
      { $match: { role: "CIDADAO" } },
      { $group: { _id: "$neighborhood", total: { $sum: 1 }, latitude: { $avg: "$latitude" }, longitude: { $avg: "$longitude" } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]),
    User.aggregate([
      { $match: { role: "CIDADAO" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Neighborhood.find({ isActive: true }).select("name centerLat centerLng"),
    SystemSettings.findOne()
  ]);

  const countByNeighborhood = new Map(topNeighborhoods.map((item) => [item._id || "Nao informado", item.total]));
  const lowAdhesionNeighborhoods = neighborhoods
    .map((item) => ({
      neighborhood: item.get("name"),
      total: countByNeighborhood.get(item.get("name")) ?? 0,
      latitude: item.get("centerLat"),
      longitude: item.get("centerLng")
    }))
    .sort((a, b) => a.total - b.total)
    .slice(0, 10);

  const inactiveUsers = Math.max(totalUsers - activeUsers, 0);
  const growthRate = usersPreviousMonth ? Math.round(((usersThisMonth - usersPreviousMonth) / usersPreviousMonth) * 100) : usersThisMonth ? 100 : 0;
  const activationRate = totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0;

  res.json({
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersToday,
    usersThisMonth,
    growthRate,
    appDownloads: settings?.get("appDownloads") ?? 0,
    activationRate,
    topNeighborhoods: topNeighborhoods.map((item) => ({
      neighborhood: item._id || "Nao informado",
      total: item.total,
      latitude: item.latitude,
      longitude: item.longitude
    })),
    lowAdhesionNeighborhoods,
    registrationsByMonth: registrationsByMonth.map((item) => ({ month: item._id, total: item.total })),
    usersWithCoordinates
  });
});

async function neighborhoodActivityRanking() {
  const [users, demands, events] = await Promise.all([
    User.aggregate([{ $match: { role: "CIDADAO" } }, { $group: { _id: "$neighborhood", total: { $sum: 1 } } }]),
    Demand.aggregate([{ $group: { _id: "$neighborhood", total: { $sum: 1 } } }]),
    Event.aggregate([{ $match: { isPublished: true } }, { $group: { _id: "$neighborhood", total: { $sum: 1 } } }])
  ]);
  const totals = new Map<string, number>();
  for (const collection of [users, demands, events]) {
    for (const item of collection) {
      const key = item._id || "Nao informado";
      totals.set(key, (totals.get(key) ?? 0) + item.total);
    }
  }
  return Array.from(totals.entries()).map(([neighborhood, total]) => ({ _id: neighborhood, total })).sort((a, b) => b.total - a.total);
}

function normalizeDemandEvolution(rows: Array<{ _id: { month: string; status: string }; total: number }>) {
  const byMonth = new Map<string, { _id: string; abertas: number; resolvidas: number; total: number }>();
  for (const row of rows) {
    const month = row._id.month;
    const current = byMonth.get(month) ?? { _id: month, abertas: 0, resolvidas: 0, total: 0 };
    current.total += row.total;
    if (row._id.status === "RESOLVIDO") current.resolvidas += row.total;
    else current.abertas += row.total;
    byMonth.set(month, current);
  }
  return Array.from(byMonth.values()).sort((a, b) => a._id.localeCompare(b._id));
}

async function calculateMostMentionedTopics() {
  const demands = await Demand.find().select("title description type");
  const topicMap: Record<string, string[]> = {
    "Iluminacao": ["iluminacao", "lampada", "poste", "escuro", "energia"],
    "Saude": ["saude", "posto", "medico", "ubs", "remedio", "consulta"],
    "Infraestrutura": ["rua", "asfalto", "buraco", "ponte", "pavimentacao", "estrada"],
    "Limpeza": ["lixo", "entulho", "coleta", "limpeza", "mato"],
    "Educacao": ["escola", "creche", "aluno", "professor", "transporte escolar"],
    "Seguranca": ["seguranca", "assalto", "ronda", "iluminacao publica"]
  };
  const counts = new Map<string, number>();
  for (const demand of demands) {
    const text = normalizeText(`${demand.get("title") ?? ""} ${demand.get("description") ?? ""} ${demand.get("type") ?? ""}`);
    for (const [topic, terms] of Object.entries(topicMap)) {
      const matches = terms.filter((term) => text.includes(normalizeText(term))).length;
      if (matches) counts.set(topic, (counts.get(topic) ?? 0) + matches);
    }
  }
  return Array.from(counts.entries()).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function buildActivityTimeline(input: {
  posts: any[];
  recentEvents: any[];
  recentSurveys: any[];
  recentNotifications: any[];
  resolvedRecentDemands: any[];
}) {
  return [
    ...input.posts.map((item) => ({ type: "Comunicado publicado", label: item.get("title"), date: item.get("publishedAt") ?? item.get("createdAt") })),
    ...input.recentEvents.map((item) => ({ type: "Evento criado", label: item.get("title"), date: item.get("createdAt") })),
    ...input.recentSurveys.map((item) => ({ type: "Enquete aberta", label: item.get("title"), date: item.get("createdAt") })),
    ...input.resolvedRecentDemands.map((item) => ({ type: "Demanda resolvida", label: item.get("title"), date: item.get("resolvedAt") ?? item.get("updatedAt") })),
    ...input.recentNotifications.map((item) => ({ type: "Notificacao enviada", label: item.get("title"), date: item.get("createdAt") }))
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);
}
