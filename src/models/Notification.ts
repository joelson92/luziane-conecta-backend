import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    body: String,
    targetType: {
      type: String,
      enum: ["ALL", "NEIGHBORHOOD", "COMMUNITY", "AGE_RANGE", "INTERESTS", "ROLE", "PROFILE", "SPECIFIC_USERS"],
      required: true
    },
    targetFilters: {
      neighborhoods: { type: [String], default: [] },
      communities: { type: [String], default: [] },
      interests: { type: [String], default: [] },
      roles: { type: [String], default: [] },
      profiles: { type: [String], default: [] },
      ageMin: Number,
      ageMax: Number,
      userIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] }
    },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    clickedCount: { type: Number, default: 0 },
    /** Data/hora agendada para envio */
    scheduledAt: Date,
    /** Recorrência: NONE = envio único, WEEKLY = semanal, MONTHLY = mensal */
    recurrence: { type: String, enum: ["NONE", "WEEKLY", "MONTHLY"], default: "NONE" },
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "SENT", "FAILED", "partial", "no_recipients"], default: "DRAFT" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    sentAt: Date,
    failedTokensCount: { type: Number, default: 0 },
    lastError: { type: String },
    providerResponse: { type: Schema.Types.Mixed },

    // Unified targeting properties
    audienceType: { type: String, enum: ["all", "segmented"], default: "all" },
    targetNeighborhoods: { type: [String], default: [] },
    targetCommunities: { type: [String], default: [] },
    targetRoles: { type: [String], default: [] },
    targetProfiles: { type: [String], default: [] },
    targetInterests: { type: [String], default: [] },
    targetUserIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    targetAgeRange: {
      min: Number,
      max: Number
    }
  },
  { timestamps: true }
);

import { cleanTargetArray } from "../utils/audience.js";

notificationSchema.pre("validate", function(next) {
  this.targetNeighborhoods = cleanTargetArray(this.targetNeighborhoods);
  this.targetCommunities = cleanTargetArray(this.targetCommunities);
  this.targetRoles = cleanTargetArray(this.targetRoles);
  this.targetProfiles = cleanTargetArray(this.targetProfiles);
  this.targetInterests = cleanTargetArray(this.targetInterests);

  if (this.targetFilters) {
    this.targetFilters.neighborhoods = cleanTargetArray(this.targetFilters.neighborhoods);
    this.targetFilters.communities = cleanTargetArray(this.targetFilters.communities);
    this.targetFilters.roles = cleanTargetArray(this.targetFilters.roles);
    this.targetFilters.profiles = cleanTargetArray(this.targetFilters.profiles);
    this.targetFilters.interests = cleanTargetArray(this.targetFilters.interests);
  }

  next();
});

export const Notification = mongoose.model("Notification", notificationSchema);
