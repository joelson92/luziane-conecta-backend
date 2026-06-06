import { User } from "../models/index.js";

// ─── Role constants ─────────────────────────────────────────────────────────────
export const citizenRole = "CIDADAO";

/** All role values that represent a citizen across DB variants. */
export const CITIZEN_ROLES = [
  "CIDADAO", "cidadao", "citizen", "CITIZEN", "Cidadão", "cidadão", "CIDADÃO"
] as const;

export const citizenRoleFilter = { $in: [...CITIZEN_ROLES] };

// ─── THE single map query (all active users with valid coordinates) ────────────
/**
 * Returns ALL active users who have valid numeric lat/lng.
 * Role is NOT filtered — super admins, prefeita, assessors and citizens all appear
 * on the map if they have coordinates.
 * Run `fix:locationConfirmed` to backfill locationConfirmed on old records.
 */
export async function getConfirmedMapUsers() {
  // Step 1: diagnostic — all active users regardless of coordinates
  const allActiveUsers = await User
    .find({ isActive: true })
    .select("name role isActive latitude longitude locationConfirmed locationSource neighborhoodName neighborhood city state street number community")
    .lean();

  // Step 2: keep only those with finite numeric coordinates
  const confirmed = allActiveUsers.filter(u => {
    const lat = u.latitude;
    const lng = u.longitude;
    return (
      lat !== null && lat !== undefined && typeof lat === "number" && isFinite(lat) &&
      lng !== null && lng !== undefined && typeof lng === "number" && isFinite(lng)
    );
  });

  return confirmed;
}

/** @deprecated Use getConfirmedMapUsers instead */
export const getConfirmedCitizenMapUsers = getConfirmedMapUsers;

// ─── Legacy helpers (used by dashboard, mapUserStats, etc.) ────────────────────
export function activeCitizenQuery(extra: Record<string, unknown> = {}) {
  return {
    role: citizenRoleFilter,
    isActive: true,
    ...extra
  };
}

export function missingUserCoordinateQuery(extra: Record<string, unknown> = {}) {
  return {
    ...activeCitizenQuery(extra),
    $or: [
      { latitude: { $exists: false } },
      { longitude: { $exists: false } },
      { latitude: null },
      { longitude: null }
    ]
  };
}

export function validUserCoordinateQuery(extra: Record<string, unknown> = {}) {
  return {
    ...activeCitizenQuery(extra),
    latitude: { $type: "number" },
    longitude: { $type: "number" }
  };
}

export async function getCitizenGeoStats(extra: Record<string, unknown> = {}) {
  const baseQuery = activeCitizenQuery(extra);
  const geoQuery = validUserCoordinateQuery(extra);
  const [activeCitizens, geolocatedCitizens] = await Promise.all([
    User.countDocuments(baseQuery),
    User.countDocuments(geoQuery)
  ]);

  return {
    activeCitizens,
    geolocatedCitizens,
    withoutGeo: Math.max(activeCitizens - geolocatedCitizens, 0)
  };
}

export function normalizeUserCoordinates<T extends Record<string, any>>(payload: T): T {
  const next: Record<string, any> = { ...payload };
  const latitude = firstNumber(
    next.latitude,
    next.location?.lat,
    next.address?.latitude,
    next.coordinates?.lat
  );
  const longitude = firstNumber(
    next.longitude,
    next.location?.lng,
    next.address?.longitude,
    next.coordinates?.lng
  );

  if (latitude !== undefined) next.latitude = latitude;
  if (longitude !== undefined) next.longitude = longitude;

  return next as T;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}
