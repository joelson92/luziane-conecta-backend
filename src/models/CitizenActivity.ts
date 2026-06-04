import mongoose, { Schema } from "mongoose";

const citizenActivitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    points: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const CitizenActivity = mongoose.model("CitizenActivity", citizenActivitySchema);
