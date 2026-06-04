import mongoose, { Schema } from "mongoose";

const neighborhoodSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    communities: [String],
    polygonGeoJson: Schema.Types.Mixed,
    centerLat: Number,
    centerLng: Number,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Neighborhood = mongoose.model("Neighborhood", neighborhoodSchema);
