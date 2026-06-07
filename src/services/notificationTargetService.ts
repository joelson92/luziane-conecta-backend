import { Types } from "mongoose";
import { User } from "../models/index.js";
import type { Role } from "../types.js";
import {
  normalizeTarget,
  normalizeRole,
  cleanTargetArray,
  matchesAudience,
  buildAudienceUserQuery
} from "../utils/audience.js";

export { normalizeTarget, normalizeRole, matchesAudience };

export type TargetType = "ALL" | "NEIGHBORHOOD" | "COMMUNITY" | "AGE_RANGE" | "INTERESTS" | "ROLE" | "PROFILE" | "SPECIFIC_USERS";

export type TargetFilters = {
  neighborhoods?: string[];
  communities?: string[];
  interests?: string[];
  roles?: string[];
  profiles?: string[];
  ageMin?: number;
  ageMax?: number;
  userIds?: string[];
};

type TargetUser = {
  _id: Types.ObjectId;
  role?: Role;
  birthDate?: Date;
  neighborhood?: string;
  neighborhoodName?: string;
  community?: string;
  profile?: string;
  interests?: string[];
  expoPushToken?: string;
};

export async function resolveNotificationTargets(targetOrType: any, filters: TargetFilters = {}) {
  let targetObj: any;

  if (targetOrType && typeof targetOrType === "object") {
    targetObj = targetOrType;
  } else {
    const targetType = normalizeTargetType(targetOrType);
    const targetFilters = normalizeFilters(filters);
    targetObj = {
      audienceType: targetType === "ALL" ? "all" : "segmented",
      targetNeighborhoods: targetFilters.neighborhoods || [],
      targetCommunities: targetFilters.communities || [],
      targetRoles: targetFilters.roles || [],
      targetProfiles: targetFilters.profiles || [],
      targetInterests: targetFilters.interests || [],
      targetUserIds: targetFilters.userIds || [],
      targetAgeRange: {
        min: targetFilters.ageMin,
        max: targetFilters.ageMax
      }
    };
  }

  // Clean filters
  targetObj.targetNeighborhoods = cleanTargetArray(targetObj.targetNeighborhoods);
  targetObj.targetCommunities = cleanTargetArray(targetObj.targetCommunities);
  targetObj.targetRoles = cleanTargetArray(targetObj.targetRoles);
  targetObj.targetProfiles = cleanTargetArray(targetObj.targetProfiles);
  targetObj.targetInterests = cleanTargetArray(targetObj.targetInterests);

  const query = buildAudienceUserQuery(targetObj);
  query.isActive = true;

  // Print mandatory [NOTIFICATION_AUDIT] logs
  console.log(`[NOTIFICATION_AUDIT] payload recebido:`, JSON.stringify(targetObj));
  
  const normalizedFiltersForLog = {
    neighborhoods: targetObj.targetNeighborhoods,
    communities: targetObj.targetCommunities,
    roles: targetObj.targetRoles.map(normalizeRole),
    profiles: targetObj.targetProfiles,
    interests: targetObj.targetInterests,
    userIds: targetObj.targetUserIds || [],
    ageMin: targetObj.targetAgeRange?.min,
    ageMax: targetObj.targetAgeRange?.max
  };
  console.log(`[NOTIFICATION_AUDIT] audienceType recebido:`, targetObj.audienceType);
  console.log(`[NOTIFICATION_AUDIT] filtros recebidos:`, JSON.stringify(normalizedFiltersForLog));
  console.log(`[NOTIFICATION_AUDIT] query final:`, JSON.stringify(query));
  console.log(`[NOTIFICATION_TARGET] query final`, JSON.stringify(query));

  // Count total active users (regardless of audience filter)
  const totalActiveUsers = await User.countDocuments({ isActive: true });
  console.log(`[NOTIFICATION_AUDIT] total users ativos:`, totalActiveUsers);
  console.log(`[NOTIFICATION_TARGET] total users ativos`, totalActiveUsers);

  // Count users with any push token
  const totalUsersWithToken = await User.countDocuments({
    isActive: true,
    expoPushToken: { $exists: true, $nin: [null, ""] }
  });
  console.log(`[NOTIFICATION_AUDIT] total users com token:`, totalUsersWithToken);
  console.log(`[NOTIFICATION_TARGET] total com expoPushToken`, totalUsersWithToken);

  // Limit to active users with tokens
  const tokenQuery = {
    ...query,
    expoPushToken: { $exists: true, $nin: [null, ""] }
  };
  console.log(`[NOTIFICATION_TARGET] query final com token`, JSON.stringify(tokenQuery));

  const users = await User.find(tokenQuery)
    .select("_id role birthDate neighborhood neighborhoodName community profile interests expoPushToken")
    .lean<TargetUser[]>();

  const recipients = users.filter((user) => matchesAudience(user, targetObj));
  const tokens = recipients.flatMap(getUserTokens);

  const eligibleNeighborhoods = Array.from(new Set(recipients.map(u => u.neighborhood || u.neighborhoodName).filter(Boolean)));
  const eligibleRoles = Array.from(new Set(recipients.map(u => u.role).filter(Boolean)));

  console.log(`[NOTIFICATION_AUDIT] recipients encontrados:`, recipients.length);
  console.log(`[NOTIFICATION_AUDIT] campos de token encontrados:`, recipients.map(u => u.expoPushToken ? "expoPushToken" : "none").slice(0, 10));
  console.log(`[NOTIFICATION_TARGET] destinatarios encontrados`, recipients.length);
  console.log(`[NOTIFICATION_AUDIT] bairros elegíveis:`, eligibleNeighborhoods);
  console.log(`[NOTIFICATION_AUDIT] roles elegíveis:`, eligibleRoles);
  console.log(`[NOTIFICATION_AUDIT] tokens finais (contagem):`, tokens.length);

  return {
    users: recipients,
    tokens,
    totalRecipients: recipients.length,
    breakdown: {
      byNeighborhood: groupBy(recipients, "neighborhood"),
      byCommunity: groupBy(recipients, "community"),
      byRole: groupBy(recipients, "role"),
      byProfile: groupBy(recipients, "profile")
    }
  };
}

export function normalizeTargetType(targetType?: string): TargetType {
  const map: Record<string, TargetType> = {
    TODOS: "ALL",
    BAIRRO: "NEIGHBORHOOD",
    COMUNIDADE: "COMMUNITY",
    FAIXA_ETARIA: "AGE_RANGE",
    INTERESSES: "INTERESTS",
    PERFIL: "PROFILE",
    ALL: "ALL",
    NEIGHBORHOOD: "NEIGHBORHOOD",
    COMMUNITY: "COMMUNITY",
    AGE_RANGE: "AGE_RANGE",
    INTERESTS: "INTERESTS",
    ROLE: "ROLE",
    PROFILE: "PROFILE",
    SPECIFIC_USERS: "SPECIFIC_USERS"
  };
  return map[String(targetType || "ALL").toUpperCase()] ?? "ALL";
}

export function normalizeFilters(filters: TargetFilters = {}) {
  return {
    neighborhoods: toStringArray(filters.neighborhoods),
    communities: toStringArray(filters.communities),
    interests: toStringArray(filters.interests),
    roles: toStringArray(filters.roles).map(normalizeRole),
    profiles: toStringArray(filters.profiles),
    ageMin: optionalNumber(filters.ageMin),
    ageMax: optionalNumber(filters.ageMax),
    userIds: toStringArray(filters.userIds).filter((id) => Types.ObjectId.isValid(id))
  };
}

function getUserTokens(user: TargetUser) {
  return Array.from(new Set([user.expoPushToken].filter((token): token is string => Boolean(token?.trim()))));
}

function groupBy(users: TargetUser[], field: keyof TargetUser) {
  const grouped = new Map<string, number>();
  for (const user of users) {
    const raw = user[field];
    const key = String(Array.isArray(raw) ? raw[0] : raw || "Não informado");
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  return Array.from(grouped.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
