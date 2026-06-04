import mongoose, { Schema } from "mongoose";

const surveySchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    options: [
      {
        label: { type: String, required: true },
        votes: [{ type: Schema.Types.ObjectId, ref: "User" }]
      }
    ],
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Survey = mongoose.model("Survey", surveySchema);
