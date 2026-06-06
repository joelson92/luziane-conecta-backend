import admin from "firebase-admin";
import { env } from "../config/env.js";
import { User } from "../models/index.js";

let initialized = false;

function firebaseMessaging() {
  if (!initialized && env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        })
      });
      initialized = true;
      console.log("[PUSH_SEND] Firebase Admin inicializado com sucesso.");
    } catch (err: any) {
      console.error("[PUSH_SEND] Falha ao inicializar Firebase Admin:", err?.message);
    }
  }
  return initialized ? admin.messaging() : null;
}

function isExpoToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

/** Tipo do item de resposta da Expo Push API */
interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string; [k: string]: any };
}

/**
 * Envia notificações push via Expo Push API (gratuito, sem configuração Firebase).
 * Funciona com tokens ExponentPushToken gerados pelo expo-notifications.
 * Retorna tokens inválidos para limpeza automática.
 */
async function sendViaExpoPushApi(
  tokens: string[],
  title: string,
  body: string
): Promise<{ sent: number; failed: number; invalidTokens: string[]; providerResponse: any; lastError?: string }> {
  const messages = tokens.map((to) => ({ to, title, body, sound: "default", data: {} }));
  const invalidTokens: string[] = [];
  const allResponses: any[] = [];

  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;

  console.log(`[PUSH_SEND] provider usado: Expo Push API`);
  console.log(`[PUSH_SEND] tokens recebidos (Expo): ${tokens.length}`);
  console.log(`[PUSH_SEND] primeiro token mascarado: ${tokens[0]?.slice(0, 30)}...`);

  // Expo permite até 100 mensagens por request
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const chunkTokens = tokens.slice(i, i + 100);

    console.log(`[PUSH_SEND] payload enviado (chunk ${i / 100 + 1}):`, JSON.stringify(chunk).slice(0, 400));

    try {
      const httpResponse = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate"
        },
        body: JSON.stringify(chunk)
      });

      const rawText = await httpResponse.text();
      console.log(`[PUSH_SEND] resposta completa do provedor (HTTP ${httpResponse.status}):`, rawText.slice(0, 800));

      let result: { data?: ExpoTicket[] };
      try {
        result = JSON.parse(rawText);
      } catch {
        console.error("[PUSH_SEND] erro ao parsear resposta JSON:", rawText.slice(0, 200));
        failed += chunk.length;
        lastError = `Resposta inválida da Expo API (HTTP ${httpResponse.status}): ${rawText.slice(0, 100)}`;
        continue;
      }

      allResponses.push(result);

      if (result.data && Array.isArray(result.data)) {
        result.data.forEach((ticket, idx) => {
          if (ticket.status === "ok") {
            sent++;
          } else {
            failed++;
            const errMsg = ticket.message || ticket.details?.error || "unknown";
            lastError = `Token inválido: ${errMsg}`;
            console.log(`[PUSH_SEND] erro no token ${chunkTokens[idx]?.slice(0, 30)}...: ${errMsg}`);

            // Marcar tokens DeviceNotRegistered ou InvalidCredentials para limpeza
            if (ticket.details?.error === "DeviceNotRegistered" || ticket.details?.error === "InvalidCredentials") {
              invalidTokens.push(chunkTokens[idx]);
            }
          }
        });
        console.log(`[PUSH_SEND] successCount: ${sent} | failureCount: ${failed}`);
      } else if (!httpResponse.ok) {
        failed += chunk.length;
        lastError = `Expo API HTTP ${httpResponse.status}: ${rawText.slice(0, 200)}`;
      } else {
        // HTTP 200 mas sem array data — assume sucesso
        sent += chunk.length;
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error("[PUSH_SEND] erro completo de rede:", msg);
      lastError = `Erro de rede: ${msg}`;
      failed += chunk.length;
    }
  }

  return { sent, failed, invalidTokens, providerResponse: allResponses, lastError };
}

export async function sendTopicNotification(topic: string, title: string, body: string) {
  const messaging = firebaseMessaging();
  if (!messaging) return { sent: 0, skipped: true };
  await messaging.send({ topic, notification: { title, body } });
  return { sent: 1, skipped: false };
}

/**
 * Envia notificações push para a lista de tokens.
 * Detecta automaticamente tokens Expo (ExponentPushToken) e tokens Firebase (FCM).
 * Limpa automaticamente tokens inválidos do banco de dados.
 */
export async function sendPushToTokens(tokens: string[], title: string, body: string) {
  const uniqueTokens = Array.from(new Set(tokens.filter((t) => Boolean(t) && t.trim().length > 5)));

  console.log(`[PUSH_SEND] tokens recebidos: ${tokens.length} (únicos válidos: ${uniqueTokens.length})`);

  if (uniqueTokens.length === 0) {
    return { sent: 0, skipped: true, requested: 0, failed: 0, providerResponse: null, lastError: "Nenhum token válido recebido" };
  }

  const expoTokens = uniqueTokens.filter(isExpoToken);
  const fcmTokens = uniqueTokens.filter((t) => !isExpoToken(t));

  console.log(`[PUSH_SEND] total=${uniqueTokens.length} expo=${expoTokens.length} fcm=${fcmTokens.length}`);
  if (fcmTokens.length > 0) {
    console.log(`[PUSH_SEND] tokens FCM/inválidos detectados:`, fcmTokens.map((t) => t.slice(0, 20)));
    console.log(`[PUSH_SEND] ATENÇÃO: tokens sem prefixo 'ExponentPushToken[' não são tokens Expo válidos — serão enviados via Firebase Admin`);
  }

  let sent = 0;
  let failed = 0;
  const allInvalidTokens: string[] = [];
  let combinedProviderResponse: any[] = [];
  let lastError: string | undefined;

  // ── Expo Push Tokens ─────────────────────────────────────────────────────
  if (expoTokens.length > 0) {
    const expoResult = await sendViaExpoPushApi(expoTokens, title, body);
    sent += expoResult.sent;
    failed += expoResult.failed;
    allInvalidTokens.push(...expoResult.invalidTokens);
    combinedProviderResponse = combinedProviderResponse.concat(expoResult.providerResponse || []);
    if (expoResult.lastError) lastError = expoResult.lastError;
    console.log(`[PUSH_SEND] Expo Push final: sent=${expoResult.sent} failed=${expoResult.failed} invalidTokens=${expoResult.invalidTokens.length}`);
  }

  // ── Firebase FCM Tokens ───────────────────────────────────────────────────
  if (fcmTokens.length > 0) {
    console.log(`[PUSH_SEND] provider usado: Firebase Admin`);
    const messaging = firebaseMessaging();
    if (!messaging) {
      const msg = "Firebase Admin não inicializado (sem credenciais FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY no .env)";
      console.warn(`[PUSH_SEND] ${msg}`);
      console.warn(`[PUSH_SEND] tokens FCM não enviados:`, fcmTokens);
      failed += fcmTokens.length;
      lastError = msg;
    } else {
      for (let index = 0; index < fcmTokens.length; index += 500) {
        const chunk = fcmTokens.slice(index, index + 500);
        console.log(`[PUSH_SEND] payload enviado (FCM chunk ${index / 500 + 1}): ${chunk.length} tokens`);
        try {
          const fcmResponse = await messaging.sendEachForMulticast({
            tokens: chunk,
            notification: { title, body }
          });
          sent += fcmResponse.successCount;
          failed += fcmResponse.failureCount;
          console.log(`[PUSH_SEND] resposta completa do provedor (Firebase):`, JSON.stringify({ successCount: fcmResponse.successCount, failureCount: fcmResponse.failureCount }).slice(0, 300));
          console.log(`[PUSH_SEND] successCount: ${fcmResponse.successCount} | failureCount: ${fcmResponse.failureCount}`);

          // Registrar tokens inválidos do Firebase
          fcmResponse.responses?.forEach((r, idx) => {
            if (!r.success) {
              const errCode = r.error?.code;
              const errMsg = r.error?.message || errCode || "FCM error";
              if (!lastError) lastError = errMsg;
              if (errCode === "messaging/registration-token-not-registered" || errCode === "messaging/invalid-registration-token") {
                allInvalidTokens.push(chunk[idx]);
              }
              console.log(`[PUSH_SEND] erro completo FCM token ${chunk[idx]?.slice(0, 20)}...: ${errMsg}`);
            }
          });
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.error("[PUSH_SEND] erro completo Firebase Admin:", msg);
          lastError = `Firebase Admin: ${msg}`;
          failed += chunk.length;
        }
      }
    }
  }

  // ── Limpeza automática de tokens inválidos ────────────────────────────────
  if (allInvalidTokens.length > 0) {
    console.log(`[PUSH_SEND] limpando ${allInvalidTokens.length} tokens inválidos do banco...`);
    try {
      await User.updateMany(
        { fcmToken: { $in: allInvalidTokens } },
        { $unset: { fcmToken: 1 }, $set: { pushTokenUpdatedAt: new Date() } }
      );
      console.log(`[PUSH_SEND] tokens inválidos removidos do banco.`);
    } catch (cleanErr: any) {
      console.warn("[PUSH_SEND] erro ao limpar tokens inválidos:", cleanErr?.message);
    }
  }

  const skipped = sent === 0 && failed === 0;
  return {
    sent,
    failed,
    skipped,
    requested: uniqueTokens.length,
    invalidTokensCount: allInvalidTokens.length,
    providerResponse: combinedProviderResponse,
    lastError
  };
}
