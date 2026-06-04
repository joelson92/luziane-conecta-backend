import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";
const folders = ["posts", "demands", "events", "avatars"];
function client() {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
        throw new AppError(500, "Cloudflare R2 is not configured");
    }
    return new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY
        }
    });
}
export async function createUploadUrl(folder, fileName, contentType) {
    if (!folders.includes(folder))
        throw new AppError(400, "Invalid upload folder");
    const extension = fileName.split(".").pop();
    const key = `${folder}/${randomUUID()}${extension ? `.${extension}` : ""}`;
    const command = new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(client(), command, { expiresIn: 300 });
    const publicUrl = env.R2_PUBLIC_BASE_URL ? `${env.R2_PUBLIC_BASE_URL}/${key}` : key;
    return { key, uploadUrl, publicUrl };
}
export async function deleteObject(key) {
    await client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}
