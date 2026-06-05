import admin from "firebase-admin";
import { env } from "../config/env.js";
let initialized = false;
function app() {
    if (!initialized && env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: env.FIREBASE_PROJECT_ID,
                clientEmail: env.FIREBASE_CLIENT_EMAIL,
                privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
            })
        });
        initialized = true;
    }
    return initialized ? admin.messaging() : null;
}
export async function sendTopicNotification(topic, title, body) {
    const messaging = app();
    if (!messaging)
        return { sent: 0, skipped: true };
    await messaging.send({ topic, notification: { title, body } });
    return { sent: 1, skipped: false };
}
export async function sendPushToTokens(tokens, title, body) {
    const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
    const messaging = app();
    if (!isMessagingAvailable(messaging) || uniqueTokens.length === 0) {
        return { sent: 0, skipped: true, requested: uniqueTokens.length };
    }
    let sent = 0;
    for (let index = 0; index < uniqueTokens.length; index += 500) {
        const chunk = uniqueTokens.slice(index, index + 500);
        const response = await messaging.sendEachForMulticast({
            tokens: chunk,
            notification: { title, body }
        });
        sent += response.successCount;
    }
    return { sent, skipped: false, requested: uniqueTokens.length };
}
function isMessagingAvailable(messaging) {
    return Boolean(messaging);
}
