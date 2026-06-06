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
    alsoShareOnWhatsapp: { type: Boolean, default: false },
    whatsappUrl: { type: String, default: "" },
    customShareText: { type: String, default: "" },
    publishedAt: Date
  },
  { timestamps: true }
);

export const Post = mongoose.model("Post", postSchema);
