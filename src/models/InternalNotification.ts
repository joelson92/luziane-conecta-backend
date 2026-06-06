import mongoose, { Schema } from "mongoose";

const internalNotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true }, // null means public notification
    type: {
      type: String,
      enum: ["video", "post", "event", "poll", "demand_update", "system"],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    referenceId: { type: String },
    isRead: { type: Boolean, default: false }, // for individual notifications
    readBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] } // for public notifications
  },
  { timestamps: true }
);

export const InternalNotification = mongoose.model("InternalNotification", internalNotificationSchema);
