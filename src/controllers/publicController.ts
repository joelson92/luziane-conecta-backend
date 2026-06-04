import { z } from "zod";
import { ContactMessage } from "../models/index.js";
import { asyncHandler } from "../utils/http.js";

export const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(5)
});

export const createContact = (type: "CONTACT" | "OUVIDORIA") =>
  asyncHandler(async (req, res) => {
    const data = await ContactMessage.create({
      type,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      message: req.body.message,
      ipAddress: req.ip
    });
    res.status(201).json({ data, message: "Mensagem recebida com sucesso." });
  });

export const listContactMessages = asyncHandler(async (req, res) => {
  const query: Record<string, unknown> = {};
  if (req.query.type) query.type = req.query.type;
  const data = await ContactMessage.find(query).sort({ createdAt: -1 }).limit(200);
  res.json({ data });
});
