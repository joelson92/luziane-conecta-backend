import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { Role } from "../types.js";
import { env } from "../config/env.js";

export function signAccessToken(user: { id: string; email: string; role: Role }) {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(user, env.JWT_SECRET, options);
}

export function signRefreshToken(user: { id: string; email: string; role: Role }) {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(user, env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; email: string; role: Role };
}
