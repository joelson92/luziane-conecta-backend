import mongoose, { Schema } from "mongoose";

const systemSettingsSchema = new Schema(
  {
    appDownloads: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
