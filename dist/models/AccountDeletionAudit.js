import mongoose, { Schema } from "mongoose";
const accountDeletionAuditSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedAt: { type: Date, required: true },
    reason: String,
    ipAddress: String,
    deviceInfo: String,
    status: { type: String, enum: ["SOFT_DELETED"], default: "SOFT_DELETED" }
}, { timestamps: true });
export const AccountDeletionAudit = mongoose.model("AccountDeletionAudit", accountDeletionAuditSchema);
