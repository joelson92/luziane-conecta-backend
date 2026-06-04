import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/http.js";
import { env } from "../config/env.js";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Invalid payload", issues: error.flatten() });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({
    message: env.NODE_ENV === "production" ? "Internal server error" : message
  });
}
