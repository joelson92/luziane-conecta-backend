import mongoose, { Schema } from "mongoose";

const postSchema = new Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    content: { type: String, required: true },
    imageUrl: { type: String },
    category: {
      type: String,
      enum: ["aviso", "obra", "saude", "educacao", "evento", "campanha", "prestacao_de_contas", "urgente"],
      required: true
    },
    priority: {
      type: String,
      enum: ["normal", "destaque", "urgente"],
      default: "normal"
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft"
    },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    targetNeighborhood: { type: String },
    targetCommunity: { type: String },
    targetNeighborhoods: { type: [String], default: [] },
    targetCommunities: { type: [String], default: [] },
    targetRoles: { type: [String], default: [] },
    targetProfiles: { type: [String], default: [] },
    targetInterests: { type: [String], default: [] },
    targetUserIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    targetAgeRange: {
      min: Number,
      max: Number
    },
    audienceType: { type: String, enum: ["all", "segmented"], default: "all" },
    alsoShareOnWhatsapp: { type: Boolean, default: false },
    whatsappUrl: { type: String, default: "" },
    customShareText: { type: String, default: "" },
    publishedAt: Date
  },
  { timestamps: true }
);

import { cleanTargetArray } from "../utils/audience.js";

postSchema.pre("validate", function(next) {
  this.targetNeighborhoods = cleanTargetArray(this.targetNeighborhoods);
  this.targetCommunities = cleanTargetArray(this.targetCommunities);
  this.targetRoles = cleanTargetArray(this.targetRoles);
  this.targetProfiles = cleanTargetArray(this.targetProfiles);
  this.targetInterests = cleanTargetArray(this.targetInterests);

  if (this.targetNeighborhood) {
    const cleaned = cleanTargetArray([this.targetNeighborhood]);
    this.targetNeighborhood = cleaned.length > 0 ? cleaned[0] : undefined;
  }
  if (this.targetCommunity) {
    const cleaned = cleanTargetArray([this.targetCommunity]);
    this.targetCommunity = cleaned.length > 0 ? cleaned[0] : undefined;
  }

  next();
});

export const Post = mongoose.model("Post", postSchema);
