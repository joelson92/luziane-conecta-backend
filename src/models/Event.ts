import mongoose, { Schema } from "mongoose";

const eventSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    locationName: String,
    location: {
      lat: Number,
      lng: Number
    },
    neighborhood: String,
    startDate: { type: Date, required: true },
    endDate: Date,
    attendees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isPublished: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", eventSchema);
