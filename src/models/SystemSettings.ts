import mongoose, { Schema } from "mongoose";

const systemSettingsSchema = new Schema(
  {
    appDownloads: { type: Number, default: 0 },
    whatsappChannelUrl: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    youtubeUrl: { type: String, default: "" },
    facebookUrl: { type: String, default: "" }
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);

