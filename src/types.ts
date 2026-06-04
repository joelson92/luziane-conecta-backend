import type { Request } from "express";

export type Role = "SUPER_ADMIN" | "PREFEITA" | "ASSESSOR" | "CIDADAO";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
