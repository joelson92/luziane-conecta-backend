import mongoose, { Schema } from "mongoose";
const userConsentSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    acceptedTerms: { type: Boolean, required: true },
    acceptedPrivacy: { type: Boolean, required: true },
    acceptedAt: { type: Date, required: true },
    appVersion: { type: String, default: "1.0" },
    ipAddress: String,
    deviceInfo: String
}, { timestamps: true });
export const UserConsent = mongoose.model("UserConsent", userConsentSchema);
