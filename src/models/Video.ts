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
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    videoId: { type: String },
    provider: { type: String },

    // Unified targeting properties
    targetType: {
      type: String,
      enum: ["ALL", "NEIGHBORHOOD", "COMMUNITY", "AGE_RANGE", "INTERESTS", "ROLE", "PROFILE", "SPECIFIC_USERS"],
      default: "ALL"
    },
    targetNeighborhoods: { type: [String], default: [] },
    targetCommunities: { type: [String], default: [] },
    targetRoles: { type: [String], default: [] },
    targetProfiles: { type: [String], default: [] },
    targetInterests: { type: [String], default: [] },
    targetUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    targetAgeRange: {
      min: Number,
      max: Number
    },
    audienceType: { type: String, enum: ["all", "segmented"], default: "all" }
  },
  { timestamps: true }
);

import { cleanTargetArray } from "../utils/audience.js";

videoSchema.pre("validate", function(next) {
  this.targetNeighborhoods = cleanTargetArray(this.targetNeighborhoods);
  this.targetCommunities = cleanTargetArray(this.targetCommunities);
  this.targetRoles = cleanTargetArray(this.targetRoles);
  this.targetProfiles = cleanTargetArray(this.targetProfiles);
  this.targetInterests = cleanTargetArray(this.targetInterests);

  if (this.neighborhoodTarget) {
    const cleaned = cleanTargetArray([this.neighborhoodTarget]);
    if (cleaned.length > 0) {
      this.neighborhoodTarget = cleaned[0];
      if (!this.targetNeighborhoods.includes(cleaned[0])) {
        this.targetNeighborhoods.push(cleaned[0]);
      }
    }
  }

  if (this.communityTarget) {
    const cleaned = cleanTargetArray([this.communityTarget]);
    if (cleaned.length > 0) {
      this.communityTarget = cleaned[0];
      if (!this.targetCommunities.includes(cleaned[0])) {
        this.targetCommunities.push(cleaned[0]);
      }
    }
  }

  // Auto-set audienceType and targetType if target fields are populated
  const hasNeighborhood = this.targetNeighborhoods.length > 0 || this.neighborhoodTarget;
  const hasCommunity = this.targetCommunities.length > 0 || this.communityTarget;
  const hasRole = this.targetRoles.length > 0;
  const hasProfile = this.targetProfiles.length > 0;
  const hasInterest = this.targetInterests.length > 0;
  const hasUser = this.targetUserIds && this.targetUserIds.length > 0;
  const hasAge = this.targetAgeRange && (this.targetAgeRange.min !== undefined || this.targetAgeRange.max !== undefined);

  if (hasNeighborhood || hasCommunity || hasRole || hasProfile || hasInterest || hasUser || hasAge) {
    this.audienceType = "segmented";
    if (this.targetType === "ALL") {
      if (hasNeighborhood) this.targetType = "NEIGHBORHOOD";
      else if (hasCommunity) this.targetType = "COMMUNITY";
      else if (hasRole) this.targetType = "ROLE";
      else if (hasProfile) this.targetType = "PROFILE";
      else if (hasInterest) this.targetType = "INTERESTS";
      else if (hasUser) this.targetType = "SPECIFIC_USERS";
      else if (hasAge) this.targetType = "AGE_RANGE";
    }
  } else {
    this.audienceType = "all";
    this.targetType = "ALL";
  }

  next();
});

export const Video = mongoose.model("Video", videoSchema);
