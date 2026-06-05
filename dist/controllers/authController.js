import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { AccountDeletionAudit, PasswordReset, User, UserConsent } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/tokenService.js";
import { enrichAddressFromZipCode, enrichUserAddress } from "../services/geocodingService.js";
import { enrichNeighborhoodPayload } from "../services/neighborhoodService.js";
export const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(8),
    birthDate: z.coerce.date().optional(),
    neighborhoodId: z.string().optional(),
    neighborhoodName: z.string().optional(),
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
function publicUser(user) {
    const data = user.toObject();
    data.id = user.id;
    delete data.passwordHash;
    delete data.refreshTokenHash;
    return data;
}
async function consentStatus(userId) {
    const consent = await UserConsent.findOne({ userId, acceptedTerms: true, acceptedPrivacy: true }).sort({ acceptedAt: -1 });
    return {
        hasAcceptedLegalTerms: Boolean(consent),
        consentAcceptedAt: consent?.get("acceptedAt") ?? null
    };
}
export const register = asyncHandler(async (req, res) => {
    const exists = await User.exists({ email: req.body.email });
    if (exists)
        throw new AppError(409, "Email already registered");
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const userPayload = await enrichUserAddress(await enrichNeighborhoodPayload(await enrichAddressFromZipCode({ ...req.body, passwordHash, role: "CIDADAO", appInstalledAt: new Date(), lastLoginAt: new Date() })));
    const user = await User.create(userPayload);
    const tokenPayload = { id: user.id, email: user.get("email"), role: user.get("role") };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);
    user.set("refreshTokenHash", await bcrypt.hash(refreshToken, 10));
    await user.save();
    res.status(201).json({ user: publicUser(user), token: accessToken, accessToken, refreshToken, ...(await consentStatus(user.id)) });
});
export const login = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email, isActive: true });
    if (!user)
        throw new AppError(401, "Invalid credentials");
    const ok = await bcrypt.compare(req.body.password, user.get("passwordHash"));
    if (!ok)
        throw new AppError(401, "Invalid credentials");
    const payload = { id: user.id, email: user.get("email"), role: user.get("role") };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    user.set("refreshTokenHash", await bcrypt.hash(refreshToken, 10));
    user.set("lastLoginAt", new Date());
    await user.save();
    res.json({ user: publicUser(user), token: accessToken, accessToken, refreshToken, ...(await consentStatus(user.id)) });
});
export const refresh = asyncHandler(async (req, res) => {
    const token = req.body.refreshToken;
    if (!token)
        throw new AppError(400, "refreshToken is required");
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.id);
    if (!user)
        throw new AppError(401, "Invalid refresh token");
    const refreshTokenHash = user?.get("refreshTokenHash");
    if (!refreshTokenHash)
        throw new AppError(401, "Invalid refresh token");
    const ok = await bcrypt.compare(token, refreshTokenHash);
    if (!ok)
        throw new AppError(401, "Invalid refresh token");
    const accessToken = signAccessToken({ id: user.id, email: user.get("email"), role: user.get("role") });
    res.json({ token: accessToken, accessToken });
});
export const me = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user)
        throw new AppError(404, "User not found");
    res.json({ user: publicUser(user), ...(await consentStatus(user.id)) });
});
export const acceptConsent = asyncHandler(async (req, res) => {
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
    if (!reset)
        throw new AppError(400, "Token invalido ou expirado");
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await User.findByIdAndUpdate(reset.get("userId"), { passwordHash, refreshTokenHash: undefined });
    reset.set("usedAt", new Date());
    await reset.save();
    res.json({ message: "Senha atualizada com sucesso." });
});
export const deleteMyAccount = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user.id, { isActive: false, refreshTokenHash: undefined }, { new: true });
    if (!user)
        throw new AppError(404, "User not found");
    await AccountDeletionAudit.create({
        userId: user._id,
        requestedAt: new Date(),
        reason: req.body.reason,
        ipAddress: req.ip,
        deviceInfo: req.body.deviceInfo ?? req.headers["user-agent"]
    });
    res.json({ message: "Conta desativada com sucesso." });
});
