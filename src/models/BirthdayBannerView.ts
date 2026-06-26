import mongoose, { Schema } from "mongoose";

const birthdayBannerViewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    firstViewedAt: { type: Date, default: Date.now },
    lastViewedAt: { type: Date, default: Date.now },
    views: { type: Number, default: 1 }
  },
  { timestamps: true }
);

birthdayBannerViewSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export const BirthdayBannerView = mongoose.model("BirthdayBannerView", birthdayBannerViewSchema);
