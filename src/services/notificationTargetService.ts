import { Types } from "mongoose";
import { User } from "../models/index.js";
import type { Role } from "../types.js";

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
  community?: string;
  profile?: string;
  interests?: string[];
  fcmToken?: string;
  fcmTokens?: string[];
};

export async function resolveNotificationTargets(targetType: TargetType, filters: TargetFilters = {}) {
  const normalizedType = normalizeTargetType(targetType);
  const normalizedFilters = normalizeFilters(filters);
  const query: Record<string, unknown> = { isActive: true };

  if (normalizedType === "NEIGHBORHOOD") query.neighborhood = { $in: normalizedFilters.neighborhoods };
  if (normalizedType === "COMMUNITY") query.community = { $in: normalizedFilters.communities };
  if (normalizedType === "INTERESTS") query.interests = { $in: normalizedFilters.interests };
  if (normalizedType === "ROLE") query.role = { $in: normalizedFilters.roles };
  if (normalizedType === "PROFILE") query.profile = { $in: normalizedFilters.profiles };
  if (normalizedType === "SPECIFIC_USERS") query._id = { $in: normalizedFilters.userIds };

  let users = await User.find(query)
    .select("_id role birthDate neighborhood community profile interests fcmToken fcmTokens")
    .lean<TargetUser[]>();

  if (normalizedType === "AGE_RANGE") {
    users = users.filter((user) => isInsideAgeRange(user.birthDate, normalizedFilters.ageMin, normalizedFilters.ageMax));
  }

  const recipients = users.filter((user) => getUserTokens(user).length > 0);
  const tokens = recipients.flatMap(getUserTokens);

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
  return Array.from(new Set([user.fcmToken, ...(user.fcmTokens ?? [])].filter((token): token is string => Boolean(token?.trim()))));
}

function isInsideAgeRange(birthDate: Date | undefined, ageMin?: number, ageMax?: number) {
  if (!birthDate) return false;
  const age = calculateAge(birthDate);
  if (typeof ageMin === "number" && age < ageMin) return false;
  if (typeof ageMax === "number" && age > ageMax) return false;
  return true;
}

function calculateAge(birthDate: Date) {
  const now = new Date();
  let age = now.getFullYear() - new Date(birthDate).getFullYear();
  const monthDelta = now.getMonth() - new Date(birthDate).getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < new Date(birthDate).getDate())) age -= 1;
  return age;
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

function normalizeRole(role: string): Role {
  const map: Record<string, Role> = {
    superadmin: "SUPER_ADMIN",
    super_admin: "SUPER_ADMIN",
    mayor: "PREFEITA",
    lideranca: "PREFEITA",
    assessor: "ASSESSOR",
    advisor: "ASSESSOR",
    cidadao: "CIDADAO",
    cidadão: "CIDADAO",
    citizen: "CIDADAO"
  };
  return map[role.toLowerCase()] ?? (role as Role);
}
