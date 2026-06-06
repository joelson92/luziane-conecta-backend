/**
 * Limpa tokens inválidos (placeholder) do banco.
 * Tokens inválidos: token_a, token_b, token_c e qualquer token com prefixo FAKE
 */
import mongoose from "mongoose";
import { User } from "../models/User.js";

async function run() {
  console.log("=== LIMPEZA DE TOKENS INVÁLIDOS ===\n");
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.\n");

  try {
    // Tokens claramente inválidos (placeholder, fake, ou muito curtos)
    const result = await User.updateMany(
      {
        $or: [
          { fcmToken: { $in: ["token_a", "token_b", "token_c"] } },
          { fcmToken: /^ExponentPushToken\[FAKE_/ },
          { fcmToken: { $exists: true, $ne: null, $not: /^ExponentPushToken\[/ } }
        ]
      },
      {
        $unset: { fcmToken: 1 },
        $set: { pushTokenUpdatedAt: new Date() }
      }
    );

    console.log(`Tokens inválidos removidos: ${result.modifiedCount} usuário(s)`);

    // Verificar estado final
    const remaining = await User.find({
      isActive: true,
      fcmToken: { $exists: true, $nin: [null, ""] }
    }).select("name email neighborhood fcmToken").lean();

    console.log(`\nUsuários com token válido restantes: ${remaining.length}`);
    for (const u of remaining) {
      console.log(`  ${(u as any).name} → ${(u as any).fcmToken?.slice(0, 50)}`);
    }

    if (remaining.length === 0) {
      console.log("\n⚠ Nenhum usuário com token push válido.");
      console.log("ℹ Ação necessária:");
      console.log("  1. Abra o app mobile no celular ou Expo Go");
      console.log("  2. Faça login");
      console.log("  3. O app registrará automaticamente o token via PATCH /api/auth/me/push-token");
      console.log("  4. Após o login, os logs [PUSH_TOKEN] aparecerão no terminal do Expo");
    }

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
