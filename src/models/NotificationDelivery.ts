import mongoose, { Schema } from "mongoose";

const notificationDeliverySchema = new Schema(
  {
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["SENT", "READ"], default: "SENT" },
    deliveredAt: { type: Date, default: Date.now },
    readAt: Date
  },
  { timestamps: true }
);

export const NotificationDelivery = mongoose.model("NotificationDelivery", notificationDeliverySchema);
