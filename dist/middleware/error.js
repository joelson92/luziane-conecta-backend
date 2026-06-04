import { ZodError } from "zod";
import { AppError } from "../utils/http.js";
import { env } from "../config/env.js";
export function notFound(req, _res, next) {
    next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
export function errorHandler(error, _req, res, _next) {
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
