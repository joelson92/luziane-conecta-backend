import mongoose, { Schema } from "mongoose";
import { normalizeNeighborhoodName } from "../utils/neighborhood.js";

const neighborhoodSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    normalizedName: { type: String, trim: true, index: true, unique: true, sparse: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    communities: [String],
    polygonGeoJson: Schema.Types.Mixed,
    centerLat: Number,
    centerLng: Number,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

neighborhoodSchema.pre("validate", function setNormalizedName(next) {
  this.set("normalizedName", normalizeNeighborhoodName(this.get("name")));
  next();
});

export const Neighborhood = mongoose.model("Neighborhood", neighborhoodSchema);
