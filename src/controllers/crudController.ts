import type { Model } from "mongoose";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { buildNeighborhoodQuery } from "../services/neighborhoodService.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { handleModelCreate, handleModelUpdate } from "../services/internalNotificationService.js";

export function crudController(model: Model<any>, options: { mineField?: string; mapPayload?: (payload: Record<string, any>, req: any) => Promise<Record<string, any>> } = {}) {
  return {
    list: asyncHandler(async (req: any, res) => {
      const query: Record<string, unknown> = {};
      Object.assign(query, await buildNeighborhoodQuery({ neighborhoodId: req.query.neighborhoodId, neighborhood: req.query.neighborhood }));
      if (req.query.category) query.category = req.query.category;
      
      // Determine if the user is an admin
      let isAdmin = false;
      const authorization = req.headers.authorization;
      const match = authorization?.match(/^Bearer\s+(.+)$/i);
      const token = match?.[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, env.JWT_SECRET) as any;
          const roleMap: Record<string, string> = {
            superadmin: "SUPER_ADMIN",
            super_admin: "SUPER_ADMIN",
            mayor: "PREFEITA",
            lideranca: "PREFEITA",
            advisor: "ASSESSOR",
            assessor: "ASSESSOR",
            citizen: "CIDADAO",
            cidadao: "CIDADAO"
          };
          const normalizedRole = roleMap[decoded.role?.toLowerCase()] ?? decoded.role;
          if (["SUPER_ADMIN", "PREFEITA", "ASSESSOR"].includes(normalizedRole)) {
            isAdmin = true;
          }
        } catch {}
      }

      if (req.query.status) {
        query.status = req.query.status;
      } else if (!isAdmin) {
        // Non-admin users can only view published items (for models that have a status field)
        const hasStatusField = model.schema.paths.status !== undefined;
        if (hasStatusField && model.modelName !== "Demand") {
          query.status = "published";
        }
      }

      if (options.mineField && req.query.mine === "true") query[options.mineField] = req.user.id;
      const data = await model.find(query).sort({ createdAt: -1 }).limit(200);
      res.json({ data });
    }),
    get: asyncHandler(async (req: any, res) => {
      const item = await model.findById(req.params.id);
      if (!item) throw new AppError(404, "Resource not found");

      // Check status field access for non-admins
      if (item.status && item.status !== "published") {
        let isAdmin = false;
        const authorization = req.headers.authorization;
        const match = authorization?.match(/^Bearer\s+(.+)$/i);
        const token = match?.[1];
        if (token) {
          try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as any;
            const roleMap: Record<string, string> = {
              superadmin: "SUPER_ADMIN",
              super_admin: "SUPER_ADMIN",
              mayor: "PREFEITA",
              lideranca: "PREFEITA",
              advisor: "ASSESSOR",
              assessor: "ASSESSOR",
              citizen: "CIDADAO",
              cidadao: "CIDADAO"
            };
            const normalizedRole = roleMap[decoded.role?.toLowerCase()] ?? decoded.role;
            if (["SUPER_ADMIN", "PREFEITA", "ASSESSOR"].includes(normalizedRole)) {
              isAdmin = true;
            }
          } catch {}
        }
        if (!isAdmin) {
          throw new AppError(404, "Resource not found");
        }
      }

      res.json({ data: item });
    }),
    create: asyncHandler(async (req: any, res) => {
      const basePayload = options.mineField ? { ...req.body, [options.mineField]: req.user.id } : req.body;
      const payload = options.mapPayload ? await options.mapPayload(basePayload, req) : basePayload;
      const item = await model.create(payload);
      // Trigger internal notification in background
      handleModelCreate(model.modelName, item).catch(err => console.error("Notification trigger error:", err));
      res.status(201).json({ data: item });
    }),
    update: asyncHandler(async (req, res) => {
      const payload = options.mapPayload ? await options.mapPayload(req.body, req) : req.body;
      const item = await model.findByIdAndUpdate(req.params.id, payload, { new: true });
      if (!item) throw new AppError(404, "Resource not found");
      // Trigger internal notification in background
      handleModelUpdate(model.modelName, item).catch(err => console.error("Notification trigger error:", err));
      res.json({ data: item });
    }),
    remove: asyncHandler(async (req, res) => {
      const item = await model.findByIdAndDelete(req.params.id);
      if (!item) throw new AppError(404, "Resource not found");
      res.status(204).send();
    })
  };
}
