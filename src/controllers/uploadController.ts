import { z } from "zod";
import { asyncHandler } from "../utils/http.js";
import { createUploadUrl, deleteObject } from "../services/uploadService.js";

export const uploadRequestSchema = z.object({
  folder: z.enum(["posts", "demands", "events", "avatars"]),
  fileName: z.string().min(1),
  contentType: z.string().min(1)
});

export const getUploadUrl = asyncHandler(async (req, res) => {
  res.json(await createUploadUrl(req.body.folder, req.body.fileName, req.body.contentType));
});

export const removeUpload = asyncHandler(async (req, res) => {
  await deleteObject(req.body.key);
  res.status(204).send();
});
