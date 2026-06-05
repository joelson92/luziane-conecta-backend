import mongoose, { Schema } from "mongoose";
const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    role: {
        type: String,
        enum: ["SUPER_ADMIN", "PREFEITA", "ASSESSOR", "CIDADAO"],
        default: "CIDADAO"
    },
    birthDate: Date,
    street: String,
    number: String,
    complement: String,
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
    avatarUrl: String,
    /** Perfil profissional/social do usuário (agricultor, pescador, comerciante, etc.) */
    profile: { type: String, trim: true },
    interests: [String],
    fcmToken: String,
    fcmTokens: [String],
    points: { type: Number, default: 0 },
    level: { type: String, enum: ["BRONZE", "PRATA", "OURO", "DIAMANTE"], default: "BRONZE" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    appInstalledAt: Date,
    refreshTokenHash: String
}, { timestamps: true });
// ─── Índices para segmentação de notificações e performance de consultas ────
userSchema.index({ neighborhood: 1 });
userSchema.index({ community: 1 });
userSchema.index({ role: 1 });
userSchema.index({ profile: 1 });
userSchema.index({ interests: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isActive: 1, fcmToken: 1 });
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ isActive: 1, neighborhood: 1 });
userSchema.index({ isActive: 1, community: 1 });
export const User = mongoose.model("User", userSchema);
