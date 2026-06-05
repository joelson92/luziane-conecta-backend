import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRoutes } from "./routes/authRoutes.js";
import { crmRoutes } from "./routes/crmRoutes.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { demandRoutes, eventRoutes, neighborhoodRoutes, notificationRoutes, postRoutes, surveyRoutes, userRoutes } from "./routes/resourceRoutes.js";
import { uploadRoutes } from "./routes/uploadRoutes.js";
import { mapRoutes } from "./routes/mapRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { publicRoutes } from "./routes/publicRoutes.js";
import { auditRoutes } from "./routes/auditRoutes.js";
import { geocodingRoutes } from "./routes/geocodingRoutes.js";
import { debugRoutes } from "./routes/debugRoutes.js";
import { locationRoutes } from "./routes/locationRoutes.js";
export const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
app.use(helmet());
app.use(cors({
    origin(origin, callback) {
        if (!origin || env.CORS_ORIGIN === "*" || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));
app.use((req, _res, next) => {
    console.log("[REQUEST]", req.method, req.originalUrl);
    next();
});
app.get("/health", (_req, res) => res.json({ ok: true, name: "Luziane Conecta" }));
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/demands", demandRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/map", mapRoutes);
app.use("/api/neighborhoods", neighborhoodRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/geocoding", geocodingRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/locations", locationRoutes);
app.use(notFound);
app.use(errorHandler);
