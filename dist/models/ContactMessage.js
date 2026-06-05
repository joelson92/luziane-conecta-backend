import mongoose, { Schema } from "mongoose";
const contactMessageSchema = new Schema({
    type: { type: String, enum: ["CONTACT", "OUVIDORIA"], required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    message: { type: String, required: true },
    status: { type: String, enum: ["RECEIVED", "IN_REVIEW", "ANSWERED", "ARCHIVED"], default: "RECEIVED" },
    ipAddress: String
}, { timestamps: true });
export const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);
