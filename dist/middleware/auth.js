import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";
export function requireAuth(req, _res, next) {
    const authorization = req.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];
    if (!token) {
        console.log("[AUTH_HEADER_MISSING]", authorization);
        throw new AppError(401, "Authentication required");
    }
    try {
        req.user = jwt.verify(token, env.JWT_SECRET);
        console.log("[AUTH_USER]", req.user?.id, req.user?.role);
        next();
    }
    catch (error) {
        console.log("[AUTH_ERROR]", error instanceof Error ? error.message : error);
        throw new AppError(401, "Invalid or expired token");
    }
}
export function requireRoles(...roles) {
    return (req, _res, next) => {
        if (!req.user)
            throw new AppError(401, "Authentication required");
        const normalizedRole = normalizeRole(req.user.role);
        if (!roles.includes(normalizedRole))
            throw new AppError(403, "Insufficient permission");
        req.user.role = normalizedRole;
        next();
    };
}
export const adminRoles = ["SUPER_ADMIN", "PREFEITA", "ASSESSOR"];
function normalizeRole(role) {
    const map = {
        superadmin: "SUPER_ADMIN",
        super_admin: "SUPER_ADMIN",
        mayor: "PREFEITA",
        lideranca: "PREFEITA",
        advisor: "ASSESSOR",
        assessor: "ASSESSOR",
        citizen: "CIDADAO",
        cidadao: "CIDADAO"
    };
    return map[role.toLowerCase()] ?? role;
}
