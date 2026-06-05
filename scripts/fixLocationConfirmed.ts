/**
 * Migration: fixLocationConfirmed.ts
 *
 * For every active citizen who already has numeric lat/lng but is missing
 * locationConfirmed=true, set:
 *   locationConfirmed = true
 *   locationSource    = existing value || "MANUAL_PIN"
 *   locationConfirmedAt = existing value || now
 *
 * Run with:
 *   npx tsx scripts/fixLocationConfirmed.ts
 */

import mongoose from "mongoose";
import { connectDatabase } from "../src/config/db.js";
import { User } from "../src/models/index.js";

await connectDatabase();

const CITIZEN_ROLES = [
  "CIDADAO", "cidadao", "citizen", "CITIZEN", "Cidadão", "cidadão", "CIDADÃO"
];

const citizens = await User.find({
  role: { $in: CITIZEN_ROLES },
  isActive: true
});

let fixed = 0;
let alreadyOk = 0;
let noCoords = 0;

for (const user of citizens) {
  const lat = user.get("latitude");
  const lng = user.get("longitude");

  // No valid coordinates — skip
  const hasCoords =
    typeof lat === "number" && isFinite(lat) &&
    typeof lng === "number" && isFinite(lng);

  if (!hasCoords) {
    noCoords += 1;
    continue;
  }

  // Already confirmed — skip
  if (user.get("locationConfirmed") === true) {
    alreadyOk += 1;
    continue;
  }

  user.set("locationConfirmed", true);
  if (!user.get("locationSource")) user.set("locationSource", "MANUAL_PIN");
  if (!user.get("locationConfirmedAt")) user.set("locationConfirmedAt", new Date());

  await user.save();
  fixed += 1;

  console.log(`[FIX] ${user.get("name")} (${user.get("role")}) — lat: ${lat}, lng: ${lng}`);
}

console.log("\n[FIX_LOCATION_CONFIRMED] Done.", {
  total: citizens.length,
  fixed,
  alreadyOk,
  noCoords
});

await mongoose.disconnect();
