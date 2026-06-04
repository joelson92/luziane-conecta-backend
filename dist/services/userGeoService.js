import { User } from "../models/index.js";
export const citizenRole = "CIDADAO";
export const citizenRoleFilter = { $in: [citizenRole, "citizen", "cidadao", "cidadão"] };
export function activeCitizenQuery(extra = {}) {
    return {
        role: citizenRoleFilter,
        isActive: true,
        ...extra
    };
}
export function validUserCoordinateQuery(extra = {}) {
    return {
        ...activeCitizenQuery(extra),
        latitude: { $type: "number" },
        longitude: { $type: "number" }
    };
}
export async function getCitizenGeoStats(extra = {}) {
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
export function normalizeUserCoordinates(payload) {
    const next = { ...payload };
    const latitude = firstNumber(next.latitude, next.location?.lat, next.address?.latitude, next.coordinates?.lat);
    const longitude = firstNumber(next.longitude, next.location?.lng, next.address?.longitude, next.coordinates?.lng);
    if (latitude !== undefined)
        next.latitude = latitude;
    if (longitude !== undefined)
        next.longitude = longitude;
    return next;
}
function firstNumber(...values) {
    for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value))
            return value;
        if (typeof value === "string" && value.trim() !== "") {
            const parsed = Number(value);
            if (Number.isFinite(parsed))
                return parsed;
        }
    }
    return undefined;
}
