import mongoose, { Schema } from "mongoose";
import { normalizeNeighborhoodName } from "../utils/neighborhood.js";
const neighborhoodSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true },
    normalizedName: { type: String, trim: true, index: true, unique: true, sparse: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    communities: [String],
    polygonGeoJson: Schema.Types.Mixed,
    centerLat: Number,
    centerLng: Number,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
neighborhoodSchema.pre("validate", function setNormalizedName(next) {
    this.set("normalizedName", normalizeNeighborhoodName(this.get("name")));
    next();
});
/**
 * @deprecated
 * Mantido APENAS para compatibilidade histórica com dados legados.
 *
 * Não deve ser utilizado em:
 *   - Dashboard
 *   - CRM
 *   - Notificações
 *   - Mapa Territorial
 *   - Segmentação de usuários
 *
 * Fonte oficial territorial (fonte única da verdade):
 *   User.neighborhood
 *   User.community
 *   User.location
 *   User.profile
 *   User.interests
 *
 * Pronto para exclusão em migração futura.
 */
export const Neighborhood = mongoose.model("Neighborhood", neighborhoodSchema);
if (process.env.NODE_ENV === "development") {
    console.warn("[DEPRECATED] Neighborhood model is loaded. " +
        "It should NOT be used in Dashboard, CRM, Notifications, or MapPage. " +
        "Use User.neighborhood / User.community / User.location instead.");
}
