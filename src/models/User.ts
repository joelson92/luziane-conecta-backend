import mongoose, { Schema } from "mongoose";
import type { Role } from "../types.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "PREFEITA", "ASSESSOR", "CIDADAO"] satisfies Role[],
      default: "CIDADAO"
    },
    birthDate: Date,
    street: String,
    number: String,
    complement: String,
    neighborhood: String,
    community: String,
    city: { type: String, default: "Benevides" },
    state: { type: String, default: "PA" },
    country: { type: String, default: "Brasil" },
    zipCode: String,
    latitude: Number,
    longitude: Number,
    formattedAddress: String,
    geocodedAt: Date,
    geocodingProvider: String,
    geocodingStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    geocodingConfidence: Number,
    avatarUrl: String,
    interests: [String],
    fcmToken: String,
    fcmTokens: [String],
    points: { type: Number, default: 0 },
    level: { type: String, enum: ["BRONZE", "PRATA", "OURO", "DIAMANTE"], default: "BRONZE" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    appInstalledAt: Date,
    refreshTokenHash: String
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
