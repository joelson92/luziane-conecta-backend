import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/tokenService.js";
import { enrichUserAddress } from "../services/geocodingService.js";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  birthDate: z.coerce.date().optional(),
  neighborhood: z.string().optional(),
  community: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  interests: z.array(z.string()).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function publicUser(user: any) {
  const data = user.toObject();
  data.id = user.id;
  delete data.passwordHash;
  delete data.refreshTokenHash;
  return data;
}

export const register = asyncHandler(async (req, res) => {
  const exists = await User.exists({ email: req.body.email });
  if (exists) throw new AppError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const userPayload = await enrichUserAddress({ ...req.body, passwordHash, role: "CIDADAO", appInstalledAt: new Date(), lastLoginAt: new Date() });
  const user = await User.create(userPayload);
  const tokenPayload = { id: user.id, email: user.get("email"), role: user.get("role") };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);
  user.set("refreshTokenHash", await bcrypt.hash(refreshToken, 10));
  await user.save();
  res.status(201).json({ user: publicUser(user), token: accessToken, accessToken, refreshToken });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (!user) throw new AppError(401, "Invalid credentials");
  const ok = await bcrypt.compare(req.body.password, user.get("passwordHash"));
  if (!ok) throw new AppError(401, "Invalid credentials");

  const payload = { id: user.id, email: user.get("email"), role: user.get("role") };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  user.set("refreshTokenHash", await bcrypt.hash(refreshToken, 10));
  user.set("lastLoginAt", new Date());
  await user.save();
  res.json({ user: publicUser(user), token: accessToken, accessToken, refreshToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken;
  if (!token) throw new AppError(400, "refreshToken is required");
  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.id);
  if (!user) throw new AppError(401, "Invalid refresh token");
  const refreshTokenHash = user?.get("refreshTokenHash") as string | undefined;
  if (!refreshTokenHash) throw new AppError(401, "Invalid refresh token");
  const ok = await bcrypt.compare(token, refreshTokenHash);
  if (!ok) throw new AppError(401, "Invalid refresh token");
  const accessToken = signAccessToken({ id: user.id, email: user.get("email"), role: user.get("role") });
  res.json({ token: accessToken, accessToken });
});

export const me = asyncHandler(async (req: any, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: publicUser(user) });
});
