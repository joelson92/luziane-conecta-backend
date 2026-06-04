import mongoose from "mongoose";
import { connectDatabase } from "../src/config/db.js";
import { Demand, Event, Neighborhood, User } from "../src/models/index.js";
import { displayNeighborhoodName, normalizeNeighborhoodName } from "../src/utils/neighborhood.js";

const initialNeighborhoods = ["Benfica", "Centro", "Maguari", "Murinin", "Parque Verde", "Santa Maria", "Médice"];

await connectDatabase();

for (const name of initialNeighborhoods) {
  const normalizedName = normalizeNeighborhoodName(name);
  const existing = await Neighborhood.findOne({ $or: [{ normalizedName }, { name }] });
  if (existing) {
    existing.set("name", name);
    existing.set("normalizedName", normalizedName);
    existing.set("isActive", true);
    await existing.save();
    continue;
  }
  await Neighborhood.updateOne(
    { normalizedName },
    { $set: { name, normalizedName, isActive: true }, $setOnInsert: { communities: [] } },
    { upsert: true }
  );
}

const users = await migrateCollection(User, "User");
const demands = await migrateCollection(Demand, "Demand");
const events = await migrateCollection(Event, "Event");

console.log("[MIGRATE_NEIGHBORHOODS]", { users, demands, events });
await mongoose.disconnect();

async function migrateCollection(model: any, label: string) {
  const records = await model.find({
    $or: [
      { neighborhoodId: { $exists: false } },
      { neighborhoodId: null },
      { neighborhoodName: { $exists: false } },
      { neighborhoodName: null }
    ]
  });
  let updated = 0;

  for (const record of records) {
    const rawName = record.get("neighborhoodName") || record.get("neighborhood") || record.get("address.neighborhood");
    const neighborhood = await getNeighborhood(rawName);
    if (!neighborhood) continue;

    record.set("neighborhoodId", neighborhood._id);
    record.set("neighborhoodName", neighborhood.get("name"));
    record.set("neighborhood", neighborhood.get("name"));
    if (record.get("address")) {
      record.set("address.neighborhoodId", neighborhood._id);
      record.set("address.neighborhoodName", neighborhood.get("name"));
      record.set("address.neighborhood", neighborhood.get("name"));
    }
    await record.save();
    updated += 1;
  }

  console.log(`[MIGRATE_${label.toUpperCase()}_NEIGHBORHOODS]`, updated);
  return updated;
}

async function getNeighborhood(rawName?: string | null) {
  const normalizedName = normalizeNeighborhoodName(rawName);
  if (!normalizedName) return null;
  const displayName = displayNeighborhoodName(rawName);
  const existing = await Neighborhood.findOne({ $or: [{ normalizedName }, { name: displayName }] });
  if (existing && !existing.get("normalizedName")) {
    existing.set("normalizedName", normalizedName);
    await existing.save();
  }
  if (existing) return existing;
  return Neighborhood.create({
    name: displayName,
    normalizedName,
    communities: [],
    isActive: true
  });
}
