import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { User } from "../models/index.js";

const expo = new Expo();

type PushResult = {
  sent: number;
  failed: number;
  skipped: boolean;
  requested: number;
  invalidTokensCount: number;
  providerResponse: ExpoPushTicket[];
  lastError?: string;
};

/**
 * Envia notificacoes push exclusivamente pela Expo Push API.
 * Tokens sem formato Expo sao contabilizados como falha e nao sao enviados via Firebase.
 */
export async function sendPushToTokens(tokens: string[], title: string, body: string, data: Record<string, unknown> = {}): Promise<PushResult> {
  const uniqueTokens = Array.from(new Set(tokens.map((token) => token?.trim()).filter((token): token is string => Boolean(token))));
  const validTokens = uniqueTokens.filter((token) => Expo.isExpoPushToken(token));
  const invalidFormatTokens: string[] = [];
  for (const token of uniqueTokens) {
    if (!Expo.isExpoPushToken(token)) invalidFormatTokens.push(token);
  }

  console.log(`[PUSH_SEND] provider usado: Expo Push SDK`);
  console.log(`[PUSH_SEND] tokens recebidos=${tokens.length} unicos=${uniqueTokens.length} validosExpo=${validTokens.length} invalidos=${invalidFormatTokens.length}`);

  if (invalidFormatTokens.length > 0) {
    console.log("[PUSH_SEND] tokens ignorados por formato invalido", invalidFormatTokens.map((token) => token.slice(0, 24)));
  }

  if (uniqueTokens.length === 0) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      requested: 0,
      invalidTokensCount: 0,
      providerResponse: [],
      lastError: "Nenhum token valido recebido"
    };
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const responses: ExpoPushTicket[] = [];
  const invalidRegisteredTokens: string[] = [];
  let sent = 0;
  let failed = invalidFormatTokens.length;
  let lastError = invalidFormatTokens.length > 0 ? "Tokens sem formato Expo Push Token foram ignorados." : undefined;

  for (const chunk of chunks) {
    try {
      console.log(`[PUSH_SEND] enviando chunk Expo com ${chunk.length} mensagens`);
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      responses.push(...tickets);

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") {
          sent++;
          return;
        }

        failed++;
        const token = String(chunk[index]?.to ?? "");
        const errorMessage = ticket.message || ticket.details?.error || "Erro desconhecido da Expo";
        lastError = errorMessage;
        console.log(`[PUSH_SEND] erro Expo token ${token.slice(0, 24)}...: ${errorMessage}`);

        if (ticket.details?.error === "DeviceNotRegistered") {
          invalidRegisteredTokens.push(token);
        }
      });
    } catch (error: any) {
      const message = error?.message || String(error);
      console.error("[PUSH_SEND] erro completo Expo SDK:", error);
      failed += chunk.length;
      lastError = message;
      responses.push({ status: "error", message } as ExpoPushTicket);
    }
  }

  if (invalidRegisteredTokens.length > 0) {
    try {
      await User.updateMany(
        { expoPushToken: { $in: invalidRegisteredTokens } },
        { $unset: { expoPushToken: 1 }, $set: { pushTokenUpdatedAt: new Date() } }
      );
      console.log(`[PUSH_SEND] expoPushTokens invalidos removidos: ${invalidRegisteredTokens.length}`);
    } catch (error: any) {
      console.warn("[PUSH_SEND] erro ao limpar expoPushTokens invalidos:", error?.message);
    }
  }

  console.log(`[PUSH_SEND] resultado Expo sent=${sent} failed=${failed} requested=${uniqueTokens.length}`);

  return {
    sent,
    failed,
    skipped: sent === 0 && failed === 0,
    requested: uniqueTokens.length,
    invalidTokensCount: invalidFormatTokens.length + invalidRegisteredTokens.length,
    providerResponse: responses,
    lastError
  };
}
