import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    body: String,
    targetType: {
      type: String,
      enum: ["ALL", "NEIGHBORHOOD", "COMMUNITY", "AGE_RANGE", "INTERESTS", "ROLE", "SPECIFIC_USERS"],
      required: true
    },
    targetFilters: {
      neighborhoods: { type: [String], default: [] },
      communities: { type: [String], default: [] },
      interests: { type: [String], default: [] },
      roles: { type: [String], default: [] },
      ageMin: Number,
      ageMax: Number,
      userIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] }
    },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "SENT", "FAILED"], default: "DRAFT" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    sentAt: Date
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
