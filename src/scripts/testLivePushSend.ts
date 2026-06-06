/**
 * Teste ao vivo: envia push para os tokens Expo do banco e mostra resposta real da API.
 * Uso: npx tsx src/scripts/testLivePushSend.ts
 */
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { sendPushToTokens } from "../services/notificationService.js";

async function run() {
  console.log("=== TESTE LIVE DE ENVIO PUSH ===\n");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.\n");

  try {
    // 1. Buscar todos os tokens do banco
    const users = await User.find({
      isActive: true,
      fcmToken: { $exists: true, $nin: [null, ""] }
    }).select("name email neighborhood fcmToken pushPlatform").lean();

    console.log(`Usuários com token no banco: ${users.length}`);
    for (const u of users) {
      const t = (u as any).fcmToken;
      const tipo = t?.startsWith("ExponentPushToken[") ? "EXPO" :
                   t?.startsWith("ExpoPushToken[") ? "EXPO" : "FCM/INVÁLIDO";
      console.log(`  [${tipo}] ${(u as any).name} → ${t?.slice(0, 50)}`);
    }

    const tokens: string[] = users.map((u) => (u as any).fcmToken).filter(Boolean);

    if (tokens.length === 0) {
      console.log("\n❌ Nenhum token encontrado no banco. Faça login no app mobile primeiro.");
      return;
    }

    console.log(`\nEnviando push para ${tokens.length} token(s)...`);
    console.log("Título: Teste de Push Notification");
    console.log("Corpo: Esta é uma notificação de teste do Luziane Conecta.\n");

    const result = await sendPushToTokens(
      tokens,
      "Teste de Push Notification",
      "Esta é uma notificação de teste do Luziane Conecta."
    );

    console.log("\n=== RESULTADO FINAL ===");
    console.log(`  sent: ${result.sent}`);
    console.log(`  failed: ${result.failed}`);
    console.log(`  requested: ${result.requested}`);
    console.log(`  invalidTokensCount: ${(result as any).invalidTokensCount ?? 0}`);
    if ((result as any).lastError) console.log(`  lastError: ${(result as any).lastError}`);
    console.log(`  status: ${result.sent > 0 && (result.failed ?? 0) === 0 ? "SENT" : result.sent > 0 ? "partial" : "FAILED"}`);

    if ((result as any).providerResponse) {
      console.log(`\n  providerResponse completo:`);
      console.log(JSON.stringify((result as any).providerResponse, null, 2).slice(0, 2000));
    }

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
