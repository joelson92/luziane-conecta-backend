import mongoose from "mongoose";
import { normalizeNeighborhoodName } from "./neighborhood.js";

export function normalizeTarget(value: any): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeRole(role: string): string {
  const map: Record<string, string> = {
    superadmin: "SUPER_ADMIN",
    super_admin: "SUPER_ADMIN",
    mayor: "PREFEITA",
    prefeita: "PREFEITA",
    lideranca: "PREFEITA",
    lideranca_publica: "PREFEITA",
    advisor: "ASSESSOR",
    assessor: "ASSESSOR",
    citizen: "CIDADAO",
    cidadao: "CIDADAO",
    cidadão: "CIDADAO",
    citizen_user: "CIDADAO"
  };
  return map[String(role || "").toLowerCase()] ?? role;
}

export function cleanTargetArray(arr: any[] | undefined): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr
    .map(item => String(item || "").trim())
    .filter(item => {
      if (!item) return false;
      const lower = item.toLowerCase();
      return (
        lower !== "todos os bairros" &&
        lower !== "todos" &&
        lower !== "all" &&
        lower !== "todas" &&
        lower !== "todas as comunidades" &&
        lower !== "todas as roles" &&
        lower !== "todos os perfis" &&
        lower !== "todos os interesses"
      );
    });
}

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

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesAudience(user: any, target: any): boolean {
  if (!user) return false;

  const audienceType = target.audienceType || (target.targetType === "ALL" ? "all" : "segmented");
  if (audienceType === "all") {
    return true;
  }

  // Segmented target matching
  const targetNeighborhoods = target.targetNeighborhoods || target.targetFilters?.neighborhoods || [];
  const targetCommunities = target.targetCommunities || target.targetFilters?.communities || [];
  const targetRoles = target.targetRoles || target.targetFilters?.roles || [];
  const targetProfiles = target.targetProfiles || target.targetFilters?.profiles || [];
  const targetInterests = target.targetInterests || target.targetFilters?.interests || [];
  const targetUserIds = target.targetUserIds || target.targetFilters?.userIds || [];
  
  const ageMin = target.targetAgeRange?.min ?? target.targetFilters?.ageMin;
  const ageMax = target.targetAgeRange?.max ?? target.targetFilters?.ageMax;

  const normNeighborhoods = cleanTargetArray(targetNeighborhoods).map(normalizeTarget);
  const normCommunities = cleanTargetArray(targetCommunities).map(normalizeTarget);
  const normRoles = cleanTargetArray(targetRoles).map(normalizeRole).map(normalizeTarget);
  const normProfiles = cleanTargetArray(targetProfiles).map(normalizeTarget);
  const normInterests = cleanTargetArray(targetInterests).map(normalizeTarget);

  const hasNeighborhoodFilter = normNeighborhoods.length > 0;
  const hasCommunityFilter = normCommunities.length > 0;
  const hasRoleFilter = normRoles.length > 0;
  const hasProfileFilter = normProfiles.length > 0;
  const hasInterestFilter = normInterests.length > 0;
  const hasUserFilter = Array.isArray(targetUserIds) && targetUserIds.length > 0;
  const hasAgeFilter = ageMin !== undefined || ageMax !== undefined;

  if (!hasNeighborhoodFilter && !hasCommunityFilter && !hasRoleFilter && !hasProfileFilter && !hasInterestFilter && !hasUserFilter && !hasAgeFilter) {
    return false;
  }

  // OR within same category, AND between different categories.
  
  if (hasNeighborhoodFilter) {
    const userNeigh = normalizeTarget(user.neighborhoodName || user.neighborhood || user.bairro);
    if (!normNeighborhoods.includes(userNeigh)) {
      return false;
    }
  }

  if (hasCommunityFilter) {
    const userComm = normalizeTarget(user.community);
    if (!normCommunities.includes(userComm)) {
      return false;
    }
  }

  if (hasRoleFilter) {
    const userRole = normalizeTarget(normalizeRole(user.role));
    if (!normRoles.includes(userRole)) {
      return false;
    }
  }

  if (hasProfileFilter) {
    const userProf = normalizeTarget(user.profile);
    if (!normProfiles.includes(userProf)) {
      return false;
    }
  }

  if (hasInterestFilter) {
    const userInterests = (user.interests || []).map(normalizeTarget);
    const hasIntersection = userInterests.some((interest: string) => normInterests.includes(interest));
    if (!hasIntersection) {
      return false;
    }
  }

  if (hasUserFilter) {
    const userIdStr = String(user._id || user.id);
    const matched = targetUserIds.some((id: any) => String(id) === userIdStr);
    if (!matched) {
      return false;
    }
  }

  if (hasAgeFilter) {
    if (!user.birthDate) {
      return false;
    }
    const age = calculateAge(user.birthDate);
    if (ageMin !== undefined && age < Number(ageMin)) {
      return false;
    }
    if (ageMax !== undefined && age > Number(ageMax)) {
      return false;
    }
  }

  return true;
}

export function buildAudienceUserQuery(target: any): any {
  const query: Record<string, any> = { isActive: true };

  const audienceType = target.audienceType || (target.targetType === "ALL" ? "all" : "segmented");
  if (audienceType === "all") {
    return query;
  }

  const targetNeighborhoods = target.targetNeighborhoods || target.targetFilters?.neighborhoods || [];
  const targetCommunities = target.targetCommunities || target.targetFilters?.communities || [];
  const targetRoles = target.targetRoles || target.targetFilters?.roles || [];
  const targetProfiles = target.targetProfiles || target.targetFilters?.profiles || [];
  const targetInterests = target.targetInterests || target.targetFilters?.interests || [];
  const targetUserIds = target.targetUserIds || target.targetFilters?.userIds || [];
  
  const ageMin = target.targetAgeRange?.min ?? target.targetFilters?.ageMin;
  const ageMax = target.targetAgeRange?.max ?? target.targetFilters?.ageMax;

  const cleanNeighborhoods = cleanTargetArray(targetNeighborhoods);
  const cleanCommunities = cleanTargetArray(targetCommunities);
  const cleanRoles = cleanTargetArray(targetRoles).map(normalizeRole);
  const cleanProfiles = cleanTargetArray(targetProfiles);
  const cleanInterests = cleanTargetArray(targetInterests);
  const cleanUserIds = (targetUserIds || []).filter((id: any) => id && mongoose.Types.ObjectId.isValid(String(id)));

  // Resolve communities since it uses standard naming in mongoose
  const cleanComms = cleanTargetArray(targetCommunities);

  const filtersApplied: any[] = [];

  if (cleanNeighborhoods.length > 0) {
    filtersApplied.push({
      $or: [
        { neighborhood: { $in: cleanNeighborhoods.map(n => new RegExp(`^${escapeRegExp(n)}$`, 'i')) } },
        { neighborhoodName: { $in: cleanNeighborhoods.map(n => new RegExp(`^${escapeRegExp(n)}$`, 'i')) } }
      ]
    });
  }

  if (cleanComms.length > 0) {
    filtersApplied.push({
      community: { $in: cleanComms.map(c => new RegExp(`^${escapeRegExp(c)}$`, 'i')) }
    });
  }

  if (cleanRoles.length > 0) {
    filtersApplied.push({
      role: { $in: cleanRoles }
    });
  }

  if (cleanProfiles.length > 0) {
    filtersApplied.push({
      profile: { $in: cleanProfiles.map(p => new RegExp(`^${escapeRegExp(p)}$`, 'i')) }
    });
  }

  if (cleanInterests.length > 0) {
    filtersApplied.push({
      interests: { $in: cleanInterests }
    });
  }

  if (cleanUserIds.length > 0) {
    filtersApplied.push({
      _id: { $in: cleanUserIds }
    });
  }

  if (ageMin !== undefined || ageMax !== undefined) {
    const ageQuery: Record<string, any> = {};
    const now = new Date();
    if (ageMin !== undefined) {
      const maxBirthDate = new Date();
      maxBirthDate.setFullYear(now.getFullYear() - Number(ageMin));
      ageQuery.$lte = maxBirthDate;
    }
    if (ageMax !== undefined) {
      const minBirthDate = new Date();
      minBirthDate.setFullYear(now.getFullYear() - (Number(ageMax) + 1));
      ageQuery.$gte = minBirthDate;
    }
    filtersApplied.push({
      birthDate: ageQuery
    });
  }

  if (filtersApplied.length > 0) {
    query.$and = filtersApplied;
  } else {
    // Segmented but no filters means matches nobody
    query._id = null;
  }

  return query;
}

export function canUserAccessContent(user: any, content: any): boolean {
  if (!user) {
    const allowed = content.targetType === "ALL" || content.audienceType === "all";
    
    console.log("[TV_SEGMENTATION]");
    console.log("userId", null);
    console.log("role", null);
    console.log("bairro", null);
    console.log("community", null);
    console.log("profile", null);

    console.log("[TV_SEGMENTATION]");
    console.log("videoId", content._id);
    console.log("targetType", content.targetType || "ALL");
    console.log("filters", {
      neighborhoods: content.targetNeighborhoods || (content.neighborhoodTarget ? [content.neighborhoodTarget] : []),
      communities: content.targetCommunities || (content.communityTarget ? [content.communityTarget] : []),
      roles: content.targetRoles || [],
      profiles: content.targetProfiles || [],
      interests: content.targetInterests || [],
      userIds: content.targetUserIds || [],
      ageMin: content.targetAgeRange?.min,
      ageMax: content.targetAgeRange?.max
    });

    console.log("[TV_SEGMENTATION]");
    console.log("allowed =", allowed);

    return allowed;
  }

  const targetType = content.targetType || (content.audienceType === "all" ? "ALL" : "NEIGHBORHOOD");
  const targetFilters = {
    neighborhoods: content.targetNeighborhoods || (content.neighborhoodTarget ? [content.neighborhoodTarget] : []),
    communities: content.targetCommunities || (content.communityTarget ? [content.communityTarget] : []),
    roles: content.targetRoles || [],
    profiles: content.targetProfiles || [],
    interests: content.targetInterests || [],
    userIds: content.targetUserIds || [],
    ageMin: content.targetAgeRange?.min,
    ageMax: content.targetAgeRange?.max
  };

  let allowed = false;

  if (targetType === "ALL") {
    allowed = true;
  } else {
    if (targetType === "NEIGHBORHOOD") {
      const selectedNeighborhoods = cleanTargetArray(targetFilters.neighborhoods).map(n => normalizeNeighborhoodName(n)).filter(Boolean);
      if (selectedNeighborhoods.length === 0) {
        allowed = false;
      } else {
        const userNeigh = normalizeNeighborhoodName(user.neighborhoodName || user.neighborhood);
        allowed = selectedNeighborhoods.includes(userNeigh);
      }
    } else if (targetType === "COMMUNITY") {
      const selectedCommunities = cleanTargetArray(targetFilters.communities).map(c => String(c).trim().toLowerCase()).filter(Boolean);
      if (selectedCommunities.length === 0) {
        allowed = false;
      } else {
        const userComm = String(user.community || "").trim().toLowerCase();
        allowed = selectedCommunities.includes(userComm);
      }
    } else if (targetType === "ROLE") {
      const selectedRoles = cleanTargetArray(targetFilters.roles).map(r => normalizeRole(r)).filter(Boolean);
      if (selectedRoles.length === 0) {
        allowed = false;
      } else {
        const userRole = normalizeRole(user.role || "");
        allowed = selectedRoles.includes(userRole);
      }
    } else if (targetType === "PROFILE") {
      const selectedProfiles = cleanTargetArray(targetFilters.profiles).map(p => String(p).trim().toLowerCase()).filter(Boolean);
      if (selectedProfiles.length === 0) {
        allowed = false;
      } else {
        const userProfile = String(user.profile || "").trim().toLowerCase();
        allowed = selectedProfiles.includes(userProfile);
      }
    } else if (targetType === "INTERESTS") {
      const selectedInterests = cleanTargetArray(targetFilters.interests).map(i => String(i).trim().toLowerCase()).filter(Boolean);
      if (selectedInterests.length === 0) {
        allowed = false;
      } else {
        const userInterests = (user.interests || []).map((i: any) => String(i).trim().toLowerCase());
        allowed = userInterests.some((ui: string) => selectedInterests.includes(ui));
      }
    } else if (targetType === "SPECIFIC_USERS") {
      const selectedUserIds = (targetFilters.userIds || []).map((id: any) => String(id));
      if (selectedUserIds.length === 0) {
        allowed = false;
      } else {
        allowed = selectedUserIds.includes(String(user._id || user.id));
      }
    } else if (targetType === "AGE_RANGE") {
      const ageMin = targetFilters.ageMin;
      const ageMax = targetFilters.ageMax;
      if (ageMin === undefined && ageMax === undefined) {
        allowed = false;
      } else {
        if (user.birthDate) {
          const age = calculateAge(user.birthDate);
          let match = true;
          if (ageMin !== undefined && age < Number(ageMin)) match = false;
          if (ageMax !== undefined && age > Number(ageMax)) match = false;
          allowed = match;
        } else {
          allowed = false;
        }
      }
    }
  }

  // Logs obrigatórios exigidos
  console.log("[TV_SEGMENTATION]");
  console.log("userId", user._id);
  console.log("role", user.role);
  console.log("bairro", user.neighborhoodName || user.neighborhood);
  console.log("community", user.community);
  console.log("profile", user.profile);

  console.log("[TV_SEGMENTATION]");
  console.log("videoId", content._id);
  console.log("targetType", targetType);
  console.log("filters", targetFilters);

  console.log("[TV_SEGMENTATION]");
  console.log("allowed =", allowed);

  return allowed;
}
