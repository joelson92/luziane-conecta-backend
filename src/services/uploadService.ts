import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

const folders = ["posts", "demands", "events", "avatars", "videos"] as const;
export type UploadFolder = (typeof folders)[number];

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET
  );
}

function client() {
  if (!isR2Configured()) {
    throw new AppError(500, "Cloudflare R2 is not configured");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!
    }
  });
}

export function sanitizeFileName(name: string): string {
  const parts = name.split(".");
  const ext = (parts.pop() || "").toLowerCase();
  const base = parts.join(".");
  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 100);
  return `${cleanBase}.${ext}`;
}

export async function createUploadUrl(folder: UploadFolder, fileName: string, contentType: string) {
  if (!folders.includes(folder)) throw new AppError(400, "Invalid upload folder");
  const cleanName = sanitizeFileName(fileName);
  const key = `${folder}/${randomUUID()}-${cleanName}`;
  const command = new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client(), command, { expiresIn: 300 });
  const publicUrl = env.R2_PUBLIC_BASE_URL ? `${env.R2_PUBLIC_BASE_URL}/${key}` : key;
  return { key, uploadUrl, publicUrl };
}

export async function uploadDirectFile(folder: UploadFolder, fileName: string, buffer: Buffer, contentType: string) {
  if (!folders.includes(folder)) throw new AppError(400, "Invalid upload folder");
  const cleanName = sanitizeFileName(fileName);
  const key = `${folder}/${randomUUID()}-${cleanName}`;

  if (isR2Configured()) {
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });
    await client().send(command);
    const publicUrl = env.R2_PUBLIC_BASE_URL ? `${env.R2_PUBLIC_BASE_URL}/${key}` : key;
    return { key, publicUrl };
  } else {
    // Fallback Local Storage
    const uploadDir = path.join(process.cwd(), "uploads", folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, path.basename(key));
    fs.writeFileSync(filePath, buffer);
    const apiBaseUrl = env.PUBLIC_API_URL || "http://localhost:4000";
    const publicUrl = `${apiBaseUrl}/uploads/${key}`;
    return { key, publicUrl };
  }
}

export async function deleteObject(key: string) {
  if (isR2Configured()) {
    await client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
  } else {
    const filePath = path.join(process.cwd(), "uploads", key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

