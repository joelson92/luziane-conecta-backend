import mongoose from "mongoose";
import { Neighborhood } from "../models/index.js";
import { displayNeighborhoodName, normalizeNeighborhoodName } from "../utils/neighborhood.js";
export async function findOrCreateNeighborhood(name, context = {}) {
    const normalizedName = normalizeNeighborhoodName(name);
    if (!normalizedName)
        return null;
    const displayName = displayNeighborhoodName(name);
    const existing = await Neighborhood.findOne({ $or: [{ normalizedName }, { name: displayName }] });
    if (existing) {
        if (!existing.get("normalizedName")) {
            existing.set("normalizedName", normalizedName);
            await existing.save();
        }
        return existing;
    }
    return Neighborhood.create({
        name: displayName,
        normalizedName,
        city: context.city,
        state: context.state,
        communities: [],
        isActive: true
    });
}
export async function resolveNeighborhood(input) {
    const id = stringValue(input.neighborhoodId);
    if (id && mongoose.Types.ObjectId.isValid(id)) {
        const byId = await Neighborhood.findById(id);
        if (byId)
            return byId;
    }
    const name = stringValue(input.neighborhoodName) || stringValue(input.neighborhood);
    return findOrCreateNeighborhood(name, { city: input.city, state: input.state });
}
export async function enrichNeighborhoodPayload(payload) {
    const cleanPayload = stripEmptyNeighborhoodId(payload);
    console.log("[NEIGHBORHOOD_NAME]", cleanPayload.neighborhoodName ?? cleanPayload.address?.neighborhoodName);
    console.log("[NEIGHBORHOOD_INPUT]", cleanPayload.neighborhoodName ?? cleanPayload.address?.neighborhoodName, cleanPayload.neighborhoodId ?? cleanPayload.address?.neighborhoodId);
    const neighborhood = await resolveNeighborhood({
        neighborhoodId: cleanPayload.neighborhoodId ?? cleanPayload.address?.neighborhoodId,
        neighborhoodName: cleanPayload.neighborhoodName ?? cleanPayload.address?.neighborhoodName,
        neighborhood: cleanPayload.neighborhood ?? cleanPayload.address?.neighborhood,
        city: cleanPayload.city ?? cleanPayload.address?.city,
        state: cleanPayload.state ?? cleanPayload.address?.state
    });
    console.log("[NEIGHBORHOOD_RESOLVED]", neighborhood?._id, neighborhood?.get("name"));
    if (!neighborhood)
        return cleanPayload;
    const next = {
        ...cleanPayload,
        neighborhoodId: neighborhood._id,
        neighborhoodName: neighborhood.get("name"),
        neighborhood: neighborhood.get("name")
    };
    if (next.address) {
        next.address = {
            ...next.address,
            neighborhoodId: neighborhood._id,
            neighborhoodName: neighborhood.get("name"),
            neighborhood: neighborhood.get("name")
        };
    }
    return next;
}
export async function buildNeighborhoodQuery(input) {
    const id = stringValue(input.neighborhoodId);
    if (id && mongoose.Types.ObjectId.isValid(id)) {
        const neighborhood = await Neighborhood.findById(id).select("name normalizedName");
        const clauses = [{ neighborhoodId: neighborhood?._id ?? new mongoose.Types.ObjectId(id) }];
        if (neighborhood?.get("name")) {
            clauses.push({ neighborhoodName: neighborhood.get("name") }, { neighborhood: neighborhood.get("name") });
        }
        console.log("[MAP_FILTER_NEIGHBORHOOD]", id);
        return { $or: clauses };
    }
    const rawName = (id && !mongoose.Types.ObjectId.isValid(id)) ? id : stringValue(input.neighborhood);
    const normalizedName = normalizeNeighborhoodName(rawName);
    if (!normalizedName)
        return {};
    const neighborhood = await Neighborhood.findOne({ normalizedName }).select("name normalizedName");
    const clauses = [];
    if (neighborhood?._id)
        clauses.push({ neighborhoodId: neighborhood._id });
    const displayName = neighborhood?.get("name") || displayNeighborhoodName(rawName);
    clauses.push({ neighborhoodName: displayName }, { neighborhood: displayName });
    console.log("[MAP_FILTER_NEIGHBORHOOD]", neighborhood?._id?.toString() ?? normalizedName);
    return { $or: clauses };
}
export async function activeNeighborhoods() {
    const neighborhoods = await Neighborhood.find({ isActive: true }).sort({ name: 1 });
    console.log("[NEIGHBORHOODS]", neighborhoods.map((item) => item.get("name")));
    return neighborhoods;
}
function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}
export function stripEmptyNeighborhoodId(payload) {
    const next = { ...payload };
    if (!isValidObjectIdValue(next.neighborhoodId))
        delete next.neighborhoodId;
    if (next.address) {
        next.address = { ...next.address };
        if (!isValidObjectIdValue(next.address.neighborhoodId))
            delete next.address.neighborhoodId;
    }
    return next;
}
function isValidObjectIdValue(value) {
    if (value instanceof mongoose.Types.ObjectId)
        return true;
    if (typeof value !== "string")
        return false;
    if (!value || value === "undefined" || value === "null")
        return false;
    return mongoose.Types.ObjectId.isValid(value);
}
