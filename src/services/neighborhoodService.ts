import mongoose from "mongoose";
import { Neighborhood } from "../models/index.js";
import { displayNeighborhoodName, normalizeNeighborhoodName } from "../utils/neighborhood.js";

type Payload = Record<string, any>;

export async function findOrCreateNeighborhood(name?: string | null, context: { city?: string; state?: string } = {}) {
  const normalizedName = normalizeNeighborhoodName(name);
  if (!normalizedName) return null;
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

export async function resolveNeighborhood(input: { neighborhoodId?: unknown; neighborhoodName?: unknown; neighborhood?: unknown; city?: string; state?: string }) {
  const id = stringValue(input.neighborhoodId);
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const byId = await Neighborhood.findById(id);
    if (byId) return byId;
  }

  const name = stringValue(input.neighborhoodName) || stringValue(input.neighborhood);
  return findOrCreateNeighborhood(name, { city: input.city, state: input.state });
}

export async function enrichNeighborhoodPayload<T extends Payload>(payload: T): Promise<T> {
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
  if (!neighborhood) return cleanPayload as T;

  const next: Payload = {
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

  return next as T;
}

export async function buildNeighborhoodQuery(input: { neighborhoodId?: unknown; neighborhood?: unknown }) {
  const id = stringValue(input.neighborhoodId);
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const neighborhood = await Neighborhood.findById(id).select("name normalizedName");
    const clauses: Record<string, unknown>[] = [{ neighborhoodId: neighborhood?._id ?? new mongoose.Types.ObjectId(id) }];
    if (neighborhood?.get("name")) {
      clauses.push({ neighborhoodName: neighborhood.get("name") }, { neighborhood: neighborhood.get("name") });
    }
    console.log("[MAP_FILTER_NEIGHBORHOOD]", id);
    return { $or: clauses };
  }

  const rawName = stringValue(input.neighborhood);
  const normalizedName = normalizeNeighborhoodName(rawName);
  if (!normalizedName) return {};

  const neighborhood = await Neighborhood.findOne({ normalizedName }).select("name normalizedName");
  const clauses: Record<string, unknown>[] = [];
  if (neighborhood?._id) clauses.push({ neighborhoodId: neighborhood._id });
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

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function stripEmptyNeighborhoodId<T extends Payload>(payload: T): T {
  const next: Payload = { ...payload };
  if (!isValidObjectIdValue(next.neighborhoodId)) delete next.neighborhoodId;
  if (next.address) {
    next.address = { ...next.address };
    if (!isValidObjectIdValue(next.address.neighborhoodId)) delete next.address.neighborhoodId;
  }
  return next as T;
}

function isValidObjectIdValue(value: unknown) {
  if (value instanceof mongoose.Types.ObjectId) return true;
  if (typeof value !== "string") return false;
  if (!value || value === "undefined" || value === "null") return false;
  return mongoose.Types.ObjectId.isValid(value);
}
