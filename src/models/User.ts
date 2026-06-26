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
    address: String,
    neighborhoodId: { type: Schema.Types.ObjectId, ref: "Neighborhood" },
    neighborhoodName: String,
    neighborhood: String,
    community: String,
    city: String,
    state: String,
    country: { type: String, default: "Brasil" },
    zipCode: String,
    latitude: Number,
    longitude: Number,
    formattedAddress: String,
    geocodedAt: Date,
    geocodingProvider: String,
    geocodingStatus: { type: String, enum: ["pending", "success", "failed", "PENDING", "SUCCESS", "FAILED"], default: "pending" },
    geocodingConfidence: Number,
    geocodingPrecision: String,
    locationConfirmed: { type: Boolean, default: false },
    locationConfirmedAt: Date,
    locationSource: { type: String, enum: ["AUTOCOMPLETE", "GEOCODING", "MANUAL_PIN", "GPS"] },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: [Number],
      source: String,
      confirmed: Boolean
    },
    acceptedTerms: { type: Boolean, default: false },
    acceptedPrivacy: { type: Boolean, default: false },
    acceptedTermsAt: Date,
    acceptedPrivacyAt: Date,
    acceptedTermsVersion: String,
    acceptedPrivacyVersion: String,
    avatarUrl: String,
    /** Perfil profissional/social do usuário (agricultor, pescador, comerciante, etc.) */
    profile: { type: String, trim: true },
    gender: String,
    interests: [String],
    expoPushToken: String,
    pushPlatform: { type: String, enum: ["android", "ios", "web"] },
    pushTokenUpdatedAt: Date,
    pushToken: String,
    pushTokens: [String],
    notificationPermission: { type: String, default: "granted" },
    lastPushTokenAt: Date,
    points: { type: Number, default: 0 },
    level: { type: String, enum: ["BRONZE", "PRATA", "OURO", "DIAMANTE"], default: "BRONZE" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    appInstalledAt: Date,
    refreshTokenHash: String,
    forcePasswordChange: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// ─── Índices para segmentação de notificações e performance de consultas ────
userSchema.pre("validate", function removeInvalidEmptyLocation(next) {
  const location = this.get("location") as { type?: string; coordinates?: unknown[] } | undefined;
  if (!location) {
    next();
    return;
  }

  const hasValidPoint =
    location.type === "Point" &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length === 2 &&
    location.coordinates.every((value) => typeof value === "number" && Number.isFinite(value));

  if (!hasValidPoint) {
    this.set("location", undefined);
  }

  next();
});

userSchema.index({ neighborhood: 1 });
userSchema.index({ community: 1 });
userSchema.index({ role: 1 });
userSchema.index({ profile: 1 });
userSchema.index({ interests: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isActive: 1, expoPushToken: 1 });
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ isActive: 1, neighborhood: 1 });
userSchema.index({ isActive: 1, community: 1 });
userSchema.index({ location: "2dsphere" });

export const User = mongoose.model("User", userSchema);
