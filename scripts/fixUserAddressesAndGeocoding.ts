import mongoose from "mongoose";
import { connectDatabase } from "../src/config/db.js";
import { User } from "../src/models/index.js";
import { enrichAddressFromZipCode, enrichUserAddress } from "../src/services/geocodingService.js";
import { enrichNeighborhoodPayload } from "../src/services/neighborhoodService.js";
import { normalizeUserCoordinates } from "../src/services/userGeoService.js";

await connectDatabase();

const users = await User.find();
let updated = 0;
let geocoded = 0;
let failed = 0;

for (const user of users) {
  const current = user.toObject();
  const next = normalizeUserCoordinates(await enrichUserAddress(await enrichNeighborhoodPayload(await enrichAddressFromZipCode(current))));

  for (const [key, value] of Object.entries(next)) {
    if (key === "_id" || key === "__v") continue;
    user.set(key, value);
  }

  await user.save();
  updated += 1;
  if (user.get("latitude") != null && user.get("longitude") != null) geocoded += 1;
  else failed += 1;
}

console.log("[FIX_USER_ADDRESSES_AND_GEOCODING]", { updated, geocoded, failed });
await mongoose.disconnect();
