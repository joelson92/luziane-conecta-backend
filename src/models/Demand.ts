import mongoose, { Schema } from "mongoose";

const demandSchema = new Schema(
  {
    citizenId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["SUGESTAO", "RECLAMACAO", "PEDIDO", "ELOGIO"], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    photos: [String],
    location: {
      lat: Number,
      lng: Number,
      source: { type: String, enum: ["gps", "address"], default: "gps" }
    },
    address: {
      street: String,
      number: String,
      complement: String,
      neighborhoodId: { type: Schema.Types.ObjectId, ref: "Neighborhood" },
      neighborhoodName: String,
      neighborhood: String,
      community: String,
      city: String,
      state: String,
      country: { type: String, default: "Brasil" },
      zipCode: String,
      formattedAddress: String,
      geocodedAt: Date,
      geocodingProvider: String,
      geocodingStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
      geocodingConfidence: Number
    },
    neighborhoodId: { type: Schema.Types.ObjectId, ref: "Neighborhood" },
    neighborhoodName: String,
    neighborhood: String,
    community: String,
    status: {
      type: String,
      enum: ["RECEBIDO", "EM_ANALISE", "EM_ATENDIMENTO", "RESOLVIDO"],
      default: "RECEBIDO"
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    internalNotes: String,
    resolvedAt: Date
  },
  { timestamps: true }
);

export const Demand = mongoose.model("Demand", demandSchema);
