import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export function signAccessToken(user) {
    const options = { expiresIn: env.JWT_EXPIRES_IN };
    return jwt.sign(user, env.JWT_SECRET, options);
}
export function signRefreshToken(user) {
    const options = { expiresIn: env.JWT_REFRESH_EXPIRES_IN };
    return jwt.sign(user, env.JWT_REFRESH_SECRET, options);
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
