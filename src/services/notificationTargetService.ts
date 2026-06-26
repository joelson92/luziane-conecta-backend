import { Types } from "mongoose";
import { Expo } from "expo-server-sdk";
import { User } from "../models/index.js";
import type { Role } from "../types.js";
import {
  normalizeTarget,
  normalizeRole,
  cleanTargetArray,
  matchesAudience,
  buildAudienceUserQuery
} from "../utils/audience.js";
import { normalizeNeighborhoodName } from "../utils/neighborhood.js";

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
  name: string;
  role?: Role;
  birthDate?: Date;
  neighborhood?: string;
  neighborhoodName?: string;
  community?: string;
  profile?: string;
  interests?: string[];
  expoPushToken?: string;
  pushToken?: string;
  pushTokens?: string[];
  address?: { neighborhood?: string };
  location?: { neighborhood?: string };
};

function calculateAge(birthDate: Date | string): number {
  const now = new Date();
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export async function resolveNotificationTargets(targetOrType: any, filters: TargetFilters = {}) {
  let targetType: TargetType = "ALL";
  let targetFilters: TargetFilters = {};

  if (targetOrType && typeof targetOrType === "object") {
    // Se for um modelo do Mongoose ou plain object
    const doc = typeof targetOrType.get === "function" ? targetOrType : { get: (key: string) => targetOrType[key] };
    const rawTargetType = doc.get("targetType") || doc.get("target");
    if (rawTargetType) {
      targetType = normalizeTargetType(rawTargetType);
    } else if (doc.get("audienceType") === "all") {
      targetType = "ALL";
    } else {
      // Tenta inferir o tipo de segmentação com base nos campos populados
      const neighborhoods = doc.get("targetNeighborhoods") || doc.get("targetFilters")?.neighborhoods;
      const communities = doc.get("targetCommunities") || doc.get("targetFilters")?.communities;
      const roles = doc.get("targetRoles") || doc.get("targetFilters")?.roles;
      const profiles = doc.get("targetProfiles") || doc.get("targetFilters")?.profiles;
      const interests = doc.get("targetInterests") || doc.get("targetFilters")?.interests;
      const userIds = doc.get("targetUserIds") || doc.get("targetFilters")?.userIds;
      const ageMin = doc.get("targetAgeRange")?.min ?? doc.get("targetFilters")?.ageMin;
      const ageMax = doc.get("targetAgeRange")?.max ?? doc.get("targetFilters")?.ageMax;

      if (neighborhoods && cleanTargetArray(neighborhoods).length > 0) targetType = "NEIGHBORHOOD";
      else if (communities && cleanTargetArray(communities).length > 0) targetType = "COMMUNITY";
      else if (roles && cleanTargetArray(roles).length > 0) targetType = "ROLE";
      else if (profiles && cleanTargetArray(profiles).length > 0) targetType = "PROFILE";
      else if (interests && cleanTargetArray(interests).length > 0) targetType = "INTERESTS";
      else if (userIds && userIds.length > 0) targetType = "SPECIFIC_USERS";
      else if (ageMin !== undefined || ageMax !== undefined) targetType = "AGE_RANGE";
      else targetType = "NONE" as any;
    }

    const filtersField = doc.get("targetFilters") || doc.get("filters") || {};
    const rawNeighs = doc.get("targetNeighborhoods");
    const rawComms = doc.get("targetCommunities");
    const rawRoles = doc.get("targetRoles");
    const rawProfs = doc.get("targetProfiles");
    const rawInts = doc.get("targetInterests");
    const rawUsers = doc.get("targetUserIds");
    const rawAge = doc.get("targetAgeRange");

    targetFilters = {
      neighborhoods: (rawNeighs && rawNeighs.length > 0) ? rawNeighs : (filtersField.neighborhoods || filtersField.neighborhood || []),
      communities: (rawComms && rawComms.length > 0) ? rawComms : (filtersField.communities || filtersField.community || []),
      roles: (rawRoles && rawRoles.length > 0) ? rawRoles : (filtersField.roles || filtersField.role || []),
      profiles: (rawProfs && rawProfs.length > 0) ? rawProfs : (filtersField.profiles || filtersField.profile || []),
      interests: (rawInts && rawInts.length > 0) ? rawInts : (filtersField.interests || filtersField.interest || []),
      userIds: (rawUsers && rawUsers.length > 0) ? rawUsers : (filtersField.userIds || filtersField.userId || []),
      ageMin: rawAge?.min !== undefined ? rawAge.min : (filtersField.ageMin !== undefined ? filtersField.ageMin : filtersField.minAge),
      ageMax: rawAge?.max !== undefined ? rawAge.max : (filtersField.ageMax !== undefined ? filtersField.ageMax : filtersField.maxAge)
    };
  } else {
    targetType = normalizeTargetType(targetOrType);
    targetFilters = filters || {};
  }

  // Normaliza os filtros
  const normFilters = normalizeFilters(targetFilters);

  // Busca todos os usuários ativos
  const usersWithToken = await User.find({
    isActive: true
  }).select("_id name email role birthDate neighborhood neighborhoodName community profile interests expoPushToken pushToken pushTokens address location").lean<TargetUser[]>();

  let recipients: TargetUser[] = [];
  let lastError: string | null = null;

  // Logs obrigatórios exigidos
  console.log("[SEGMENTATION_AUDIT] targetType", targetType);
  console.log("[SEGMENTATION_AUDIT] filters", normFilters);

  if (targetType === "ALL") {
    recipients = usersWithToken;
  } else if (targetType === ("NONE" as any)) {
    recipients = [];
    lastError = "Segmentação inválida ou não especificada. Nenhum push enviado para evitar disparo para todos.";
  } else {
    recipients = usersWithToken;

    // 1. NEIGHBORHOOD filter
    const rawNeighborhoods = normFilters.neighborhoods || [];
    const selectedNeighborhoods = rawNeighborhoods.map(n => normalizeNeighborhoodName(n)).filter(Boolean);
    const hasNeighborhoodFilter = selectedNeighborhoods.length > 0;
    
    if (targetType === "NEIGHBORHOOD" || hasNeighborhoodFilter) {
      console.log("[NOTIFICATION_TARGET] bairros selecionados normalizados", selectedNeighborhoods);
      if (selectedNeighborhoods.length === 0) {
        lastError = "Nenhum bairro selecionado para segmentação.";
        recipients = [];
      } else {
        recipients = recipients.filter(user => {
          const userNeigh = normalizeNeighborhoodName(user.neighborhoodName || user.neighborhood || user.address?.neighborhood || user.location?.neighborhood);
          return selectedNeighborhoods.includes(userNeigh);
        });
      }
    }

    // 2. COMMUNITY filter
    if (targetType === "COMMUNITY" || (targetType === "NEIGHBORHOOD" && normFilters.communities.length > 0)) {
      const selectedCommunities = (normFilters.communities || []).map(c => String(c).trim().toLowerCase()).filter(Boolean);
      if (selectedCommunities.length === 0 && targetType === "COMMUNITY") {
        lastError = "Nenhuma comunidade selecionada para segmentação.";
        recipients = [];
      } else if (selectedCommunities.length > 0) {
        recipients = recipients.filter(user => {
          const userComm = String(user.community || "").trim().toLowerCase();
          return selectedCommunities.includes(userComm);
        });
      }
    }

    // 3. ROLE filter
    if (targetType === "ROLE" || (targetType === "NEIGHBORHOOD" && normFilters.roles.length > 0)) {
      const selectedRoles = (normFilters.roles || []).map(r => normalizeRole(r)).filter(Boolean);
      if (selectedRoles.length === 0 && targetType === "ROLE") {
        lastError = "Nenhum papel selecionado para segmentação.";
        recipients = [];
      } else if (selectedRoles.length > 0) {
        recipients = recipients.filter(user => {
          const userRole = normalizeRole(user.role || "");
          return selectedRoles.includes(userRole);
        });
      }
    }

    // 4. PROFILE filter
    if (targetType === "PROFILE" || (targetType === "NEIGHBORHOOD" && normFilters.profiles.length > 0)) {
      const selectedProfiles = (normFilters.profiles || []).map(p => String(p).trim().toLowerCase()).filter(Boolean);
      if (selectedProfiles.length === 0 && targetType === "PROFILE") {
        lastError = "Nenhum perfil profissional selecionado para segmentação.";
        recipients = [];
      } else if (selectedProfiles.length > 0) {
        recipients = recipients.filter(user => {
          const userProfile = String(user.profile || "").trim().toLowerCase();
          return selectedProfiles.includes(userProfile);
        });
      }
    }

    // 5. INTERESTS filter
    if (targetType === "INTERESTS" || (targetType === "NEIGHBORHOOD" && normFilters.interests.length > 0)) {
      const selectedInterests = (normFilters.interests || []).map(i => String(i).trim().toLowerCase()).filter(Boolean);
      if (selectedInterests.length === 0 && targetType === "INTERESTS") {
        lastError = "Nenhum interesse selecionado para segmentação.";
        recipients = [];
      } else if (selectedInterests.length > 0) {
        recipients = recipients.filter(user => {
          const userInterests = (user.interests || []).map(i => String(i).trim().toLowerCase());
          return userInterests.some(ui => selectedInterests.includes(ui));
        });
      }
    }

    // 6. AGE_RANGE filter
    if (targetType === "AGE_RANGE" || (targetType === "NEIGHBORHOOD" && (normFilters.ageMin !== undefined || normFilters.ageMax !== undefined))) {
      const ageMin = normFilters.ageMin;
      const ageMax = normFilters.ageMax;
      if (ageMin === undefined && ageMax === undefined && targetType === "AGE_RANGE") {
        lastError = "Faixa etária não configurada para segmentação.";
        recipients = [];
      } else if (ageMin !== undefined || ageMax !== undefined) {
        recipients = recipients.filter(user => {
          if (!user.birthDate) return false;
          const age = calculateAge(user.birthDate);
          if (ageMin !== undefined && age < ageMin) return false;
          if (ageMax !== undefined && age > ageMax) return false;
          return true;
        });
      }
    }

    // 7. SPECIFIC_USERS filter
    if (targetType === "SPECIFIC_USERS" || (targetType === "NEIGHBORHOOD" && normFilters.userIds.length > 0)) {
      const selectedUserIds = (normFilters.userIds || []).map(id => String(id));
      if (selectedUserIds.length === 0 && targetType === "SPECIFIC_USERS") {
        lastError = "Nenhum usuário específico selecionado para segmentação.";
        recipients = [];
      } else if (selectedUserIds.length > 0) {
        recipients = recipients.filter(user => {
          return selectedUserIds.includes(String(user._id));
        });
      }
    }
  }

  console.log("[NOTIFICATION_RECIPIENTS_FINAL]", recipients.map(u => ({
    id: u._id,
    name: u.name,
    email: (u as any).email,
    role: u.role,
    neighborhood: u.neighborhood,
    neighborhoodName: u.neighborhoodName,
    community: u.community,
    isActive: (u as any).isActive ?? true
  })));

  console.log("[NOTIFICATION_PUSH_USERS]", recipients.map(u => ({
    name: u.name,
    email: (u as any).email,
    role: u.role,
    neighborhood: u.neighborhood,
    neighborhoodName: u.neighborhoodName,
    rawTokens: {
      expoPushToken: u.expoPushToken,
      pushToken: u.pushToken,
      pushTokens: u.pushTokens
    },
    extractedTokens: getUserTokens(u)
  })));

  const tokens = recipients.flatMap(getUserTokens);

  console.log("[NOTIFICATION_PUSH_TOKENS_FROM_RECIPIENTS]", tokens);


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
    SPECIFIC_USERS: "SPECIFIC_USERS",
    NONE: "NONE" as TargetType
  };
  return map[String(targetType || "NONE").toUpperCase()] ?? ("NONE" as TargetType);
}

export function normalizeFilters(filters: any = {}) {
  const neighborhoods = filters.neighborhoods || (filters.neighborhood ? [filters.neighborhood] : []);
  const communities = filters.communities || (filters.community ? [filters.community] : []);
  const interests = filters.interests || (filters.interest ? [filters.interest] : []);
  const roles = filters.roles || (filters.role ? [filters.role] : []);
  const profiles = filters.profiles || (filters.profile ? [filters.profile] : []);
  const ageMin = filters.ageMin !== undefined ? filters.ageMin : filters.minAge;
  const ageMax = filters.ageMax !== undefined ? filters.ageMax : filters.maxAge;
  const userIds = filters.userIds || (filters.userId ? [filters.userId] : []);

  const toArray = (v: any) => (Array.isArray(v) ? v : v !== undefined && v !== null ? [v] : []);

  return {
    neighborhoods: toStringArray(toArray(neighborhoods)),
    communities: toStringArray(toArray(communities)),
    interests: toStringArray(toArray(interests)),
    roles: toStringArray(toArray(roles)).map(normalizeRole),
    profiles: toStringArray(toArray(profiles)),
    ageMin: optionalNumber(ageMin),
    ageMax: optionalNumber(ageMax),
    userIds: toStringArray(toArray(userIds)).filter((id) => Types.ObjectId.isValid(id))
  };
}

export function getUserTokens(user: TargetUser) {
  const allTokens: (string | undefined | null)[] = [
    user.expoPushToken,
    user.pushToken,
    ...(user.pushTokens || [])
  ];
  return Array.from(
    new Set(
      allTokens
        .map((t) => t?.trim())
        .filter((token: any): token is string => {
          if (!token) return false;
          // Validar se o formato corresponde a ExponentPushToken[...] ou ExpoPushToken[...] estritamente com Expo.isExpoPushToken
          return Expo.isExpoPushToken(token);
        })
    )
  );
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
