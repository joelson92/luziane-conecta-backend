import mongoose, { Schema } from "mongoose";
const postSchema = new Schema({
    category: {
        type: String,
        enum: ["NOTICIAS", "OBRAS", "SAUDE", "EDUCACAO", "ASSISTENCIA_SOCIAL", "CULTURA", "ESPORTE", "EVENTOS", "AVISOS"],
        required: true
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    images: [String],
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    targetNeighborhoods: [String],
    publishedAt: Date,
    isPublished: { type: Boolean, default: false }
}, { timestamps: true });
export const Post = mongoose.model("Post", postSchema);
