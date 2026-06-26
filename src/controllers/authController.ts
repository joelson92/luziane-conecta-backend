import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { AccountDeletionAudit, PasswordReset, User, UserConsent } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/tokenService.js";
import { enrichAddressFromZipCode, enrichUserAddress } from "../services/geocodingService.js";
import { normalizeRole } from "../middleware/auth.js";
import type { Role } from "../types.js";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().refine((value) => value.replace(/\D/g, "").length >= 8, "Phone must include at least 8 digits"),
  password: z.string().min(8),
  birthDate: z.coerce.date({ required_error: "Informe a data de nascimento." })
    .refine((date) => date <= new Date(), "Data de nascimento não pode ser futura")
    .refine((date) => date.getFullYear() >= new Date().getFullYear() - 120, "Data de nascimento inválida"),
  neighborhoodName: z.string().optional(),
  neighborhood: z.string().min(2),
  community: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  interests: z.array(z.string()).optional(),
  gender: z.string().optional(),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  acceptedTermsAt: z.coerce.date().optional(),
  acceptedPrivacyAt: z.coerce.date().optional(),
  acceptedTermsVersion: z.string().optional(),
  acceptedPrivacyVersion: z.string().optional(),
  location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90)
    ]),
    source: z.enum(["GPS", "MANUAL_PIN"]),
    confirmed: z.literal(true)
  })
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const acceptConsentSchema = z.object({
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  appVersion: z.string().optional(),
  deviceInfo: z.string().optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

const allowedRoles: Role[] = ["SUPER_ADMIN", "PREFEITA", "ASSESSOR", "CIDADAO"];

function publicUser(user: any, overrides: Record<string, unknown> = {}) {
  const data = user.toObject();
  data.id = user.id;
  Object.assign(data, overrides);
  delete data.passwordHash;
  delete data.refreshTokenHash;
  return data;
}

async function consentStatus(user: any) {
  const userId = user.id;
  const consent = await UserConsent.findOne({ userId, acceptedTerms: true, acceptedPrivacy: true }).sort({ acceptedAt: -1 });
  const acceptedOnUser = Boolean(user.get("acceptedTerms") && user.get("acceptedPrivacy"));
  return {
    hasAcceptedLegalTerms: Boolean(consent) || acceptedOnUser,
    consentAcceptedAt: consent?.get("acceptedAt") ?? user.get("acceptedTermsAt") ?? user.get("acceptedPrivacyAt") ?? null
  };
}

function isAllowedRole(role: string): role is Role {
  return allowedRoles.includes(role as Role);
}

function hasInvalidLocation(location: unknown) {
  if (!location) return false;
  const value = location as { type?: unknown; coordinates?: unknown };
  const coordinates = value.coordinates;
  return !(
    value.type === "Point" &&
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
  );
}

export const register = asyncHandler(async (req, res) => {
  const emailLower = String(req.body.email || "").toLowerCase().trim();
  const exists = await User.exists({ email: emailLower });
  if (exists) throw new AppError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(req.body.password, 12);

  const {
    name,
    phone,
    birthDate,
    neighborhood,
    neighborhoodName,
    community,
    street,
    number,
    complement,
    address,
    city,
    state,
    zipCode,
    interests,
    gender,
    acceptedTerms,
    acceptedPrivacy,
    acceptedTermsAt,
    acceptedPrivacyAt,
    acceptedTermsVersion,
    acceptedPrivacyVersion,
    location
  } = req.body;

  const rawPayload = {
    name,
    email: emailLower,
    phone,
    birthDate,
    neighborhood: neighborhood || neighborhoodName,
    neighborhoodName: neighborhoodName || neighborhood,
    community,
    street,
    number,
    complement,
    address,
    formattedAddress: address,
    city,
    state,
    zipCode,
    interests,
    gender,
    passwordHash,
    role: "CIDADAO",
    appInstalledAt: new Date(),
    lastLoginAt: new Date(),
    isActive: true,

    // Novas coordenadas geográficas integradas
    latitude: location ? location.coordinates[1] : undefined,
    longitude: location ? location.coordinates[0] : undefined,
    locationConfirmed: location ? location.confirmed : false,
    locationConfirmedAt: location ? (acceptedTermsAt || new Date()) : undefined,
    locationSource: location ? location.source : undefined,
    location,

    // Novas propriedades de aceite/consentimento
    acceptedTerms: true,
    acceptedPrivacy: true,
    acceptedTermsAt: acceptedTermsAt || new Date(),
    acceptedPrivacyAt: acceptedPrivacyAt || new Date(),
    acceptedTermsVersion: acceptedTermsVersion || "1.0",
    acceptedPrivacyVersion: acceptedPrivacyVersion || "1.0"
  };

  const userPayload = await enrichUserAddress(await enrichAddressFromZipCode(rawPayload));

  const user = await User.create(userPayload);

  await UserConsent.create({
    userId: user.id,
    acceptedTerms: true,
    acceptedPrivacy: true,
    acceptedAt: acceptedTermsAt || new Date(),
    appVersion: acceptedTermsVersion || "1.0",
    deviceInfo: "mobile-app"
  });

  const tokenPayload = { id: user.id, email: user.get("email"), role: user.get("role") };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);
  user.set("refreshTokenHash", await bcrypt.hash(refreshToken, 10));
  await user.save();

  res.status(201).json({
    user: publicUser(user),
    token: accessToken,
    accessToken,
    refreshToken,
    hasAcceptedLegalTerms: true,
    consentAcceptedAt: new Date()
  });
});

export const login = asyncHandler(async (req, res) => {
  const emailLower = String(req.body.email || "").toLowerCase().trim();
  const user = await User.findOne({ email: emailLower, isActive: true });
  
  console.log("[LOGIN_DEBUG]", {
    email: emailLower,
    userFound: !!user,
    isActive: user?.get?.("isActive"),
    role: user?.get?.("role"),
    hasPasswordHash: Boolean(user?.get?.("passwordHash"))
  });

  if (!user) throw new AppError(401, "Invalid credentials");
  const passwordHash = user.get("passwordHash");
  if (typeof passwordHash !== "string" || !passwordHash) throw new AppError(401, "Invalid credentials");
  const ok = await bcrypt.compare(req.body.password, passwordHash);

  console.log("[LOGIN_DEBUG_PASSWORD]", {
    email: emailLower,
    passwordMatch: ok
  });

  if (!ok) throw new AppError(401, "Invalid credentials");

  const originalRole = String(user.get("role") || "CIDADAO");
  const role = normalizeRole(originalRole);
  
  console.log("[ROLE_NORMALIZATION]", {
    originalRole,
    normalizedRole: role
  });

  if (!isAllowedRole(role)) throw new AppError(403, "User role is not allowed");

  const payload = { id: user.id, email: user.get("email"), role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const now = new Date();
  const update: Record<string, unknown> = {
    $set: {
      refreshTokenHash: await bcrypt.hash(refreshToken, 10),
      lastLoginAt: now,
      role
    }
  };
  if (hasInvalidLocation(user.get("location"))) {
    update.$unset = { location: "" };
    user.set("location", undefined);
  }
  await User.updateOne({ _id: user._id }, update);
  user.set("role", role);
  user.set("lastLoginAt", now);
  res.json({ user: publicUser(user, { role, lastLoginAt: now }), token: accessToken, accessToken, refreshToken, ...(await consentStatus(user)) });
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
  const role = normalizeRole(String(user.get("role") || "CIDADAO"));
  if (!isAllowedRole(role)) throw new AppError(403, "User role is not allowed");
  const accessToken = signAccessToken({ id: user.id, email: user.get("email"), role });
  res.json({ token: accessToken, accessToken });
});

export const me = asyncHandler(async (req: any, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(404, "User not found");
  res.json({ user: publicUser(user), ...(await consentStatus(user)) });
});

export const acceptConsent = asyncHandler(async (req: any, res) => {
  const consent = await UserConsent.create({
    userId: req.user.id,
    acceptedTerms: true,
    acceptedPrivacy: true,
    acceptedAt: new Date(),
    appVersion: req.body.appVersion ?? "1.0",
    ipAddress: req.ip,
    deviceInfo: req.body.deviceInfo ?? req.headers["user-agent"]
  });
  res.status(201).json({ data: consent, hasAcceptedLegalTerms: true });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (!user) {
    res.json({ message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao." });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await PasswordReset.create({
    userId: user._id,
    tokenHash: await bcrypt.hash(resetToken, 10),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ipAddress: req.ip
  });

  res.json({
    message: "Token de recuperacao gerado.",
    resetToken: process.env.NODE_ENV === "production" ? undefined : resetToken
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const resets = await PasswordReset.find({ usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(50);
  let reset = null;
  for (const candidate of resets) {
    if (await bcrypt.compare(req.body.token, candidate.get("tokenHash"))) {
      reset = candidate;
      break;
    }
  }
  if (!reset) throw new AppError(400, "Token invalido ou expirado");

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  await User.findByIdAndUpdate(reset.get("userId"), { passwordHash, refreshTokenHash: undefined });
  reset.set("usedAt", new Date());
  await reset.save();
  res.json({ message: "Senha atualizada com sucesso." });
});

export const deleteMyAccount = asyncHandler(async (req: any, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { isActive: false, refreshTokenHash: undefined }, { new: true });
  if (!user) throw new AppError(404, "User not found");
  await AccountDeletionAudit.create({
    userId: user._id,
    requestedAt: new Date(),
    reason: req.body.reason,
    ipAddress: req.ip,
    deviceInfo: req.body.deviceInfo ?? req.headers["user-agent"]
  });
  res.json({ message: "Conta desativada com sucesso." });
});
