import type { Model } from "mongoose";
import { asyncHandler, AppError } from "../utils/http.js";

export function crudController(model: Model<any>, options: { mineField?: string; mapPayload?: (payload: Record<string, any>, req: any) => Promise<Record<string, any>> } = {}) {
  return {
    list: asyncHandler(async (req: any, res) => {
      const query: Record<string, unknown> = {};
      if (req.query.neighborhood) query.neighborhood = req.query.neighborhood;
      if (req.query.category) query.category = req.query.category;
      if (req.query.status) query.status = req.query.status;
      if (options.mineField && req.query.mine === "true") query[options.mineField] = req.user.id;
      const data = await model.find(query).sort({ createdAt: -1 }).limit(200);
      res.json({ data });
    }),
    get: asyncHandler(async (req, res) => {
      const item = await model.findById(req.params.id);
      if (!item) throw new AppError(404, "Resource not found");
      res.json({ data: item });
    }),
    create: asyncHandler(async (req: any, res) => {
      const basePayload = options.mineField ? { ...req.body, [options.mineField]: req.user.id } : req.body;
      const payload = options.mapPayload ? await options.mapPayload(basePayload, req) : basePayload;
      console.log("[BODY]", req.body);
      const item = await model.create(payload);
      console.log("[CREATED]", item._id);
      res.status(201).json({ data: item });
    }),
    update: asyncHandler(async (req, res) => {
      const payload = options.mapPayload ? await options.mapPayload(req.body, req) : req.body;
      const item = await model.findByIdAndUpdate(req.params.id, payload, { new: true });
      if (!item) throw new AppError(404, "Resource not found");
      res.json({ data: item });
    }),
    remove: asyncHandler(async (req, res) => {
      const item = await model.findByIdAndDelete(req.params.id);
      if (!item) throw new AppError(404, "Resource not found");
      res.status(204).send();
    })
  };
}
