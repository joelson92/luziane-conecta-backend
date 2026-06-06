import mongoose, { Schema } from "mongoose";

const videoSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ["external", "upload"],
      default: "external",
      required: true
    },
    platform: {
      type: String,
      enum: ["youtube", "instagram", "facebook", "whatsapp", "external", "upload"],
      required: true
    },
    videoUrl: { type: String },
    videoFileUrl: { type: String },
    thumbnailUrl: { type: String },
    durationSeconds: { type: Number },
    fileSizeBytes: { type: Number },
    mimeType: { type: String },
    alsoShareOnWhatsapp: { type: Boolean, default: false },
    whatsappUrl: { type: String, default: "" },
    customShareText: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft"
    },
    publishedAt: Date,
    tags: [String],
    neighborhoodTarget: { type: String },
    communityTarget: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const Video = mongoose.model("Video", videoSchema);

