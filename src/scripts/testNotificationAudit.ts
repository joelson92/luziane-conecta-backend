import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { User, Notification, NotificationDelivery } from "../models/index.js";
import { resolveNotificationTargets, normalizeFilters } from "../services/notificationTargetService.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  console.log("=== INICIANDO TESTE DE AUDITORIA DE SEGMENTAÇÃO E TOKENS ===");
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    // Preparando dados
    const uDataA = {
      name: "Usuário A (Santos Dumont)",
      email: "audit_a@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Santos Dumont",
      neighborhoodName: "Santos Dumont",
      isActive: true,
      expoPushToken: "ExponentPushToken[AUDIT_A]",
      pushToken: "ExponentPushToken[AUDIT_A]",
      pushTokens: ["ExponentPushToken[AUDIT_A]"]
    };

    const uDataB = {
      name: "Usuário B (Duque de Caxias)",
      email: "audit_b@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      isActive: true,
      expoPushToken: "ExponentPushToken[AUDIT_B]",
      pushToken: "ExponentPushToken[AUDIT_B]",
      pushTokens: ["ExponentPushToken[AUDIT_B]"]
    };

    const uDataC = {
      name: "Usuário C (Centro, SUPER_ADMIN)",
      email: "audit_c@luziane.com",
      passwordHash: "dummy",
      role: "SUPER_ADMIN",
      neighborhood: "Centro",
      neighborhoodName: "Centro",
      isActive: true,
      expoPushToken: "ExponentPushToken[AUDIT_C]",
      pushToken: "ExponentPushToken[AUDIT_C]",
      pushTokens: ["ExponentPushToken[AUDIT_C]"]
    };

    const createOrUpdate = async (data: any) => {
      let u = await User.findOne({ email: data.email });
      if (!u) {
        u = await User.create(data);
      } else {
        Object.assign(u, data);
        await u.save();
      }
      return u;
    };

    const userA = await createOrUpdate(uDataA);
    const userB = await createOrUpdate(uDataB);
    const userC = await createOrUpdate(uDataC);

    console.log("\nUsuários criados/atualizados com sucesso.");

    // 1. Validando target resolution (Santos Dumont)
    console.log("\n-> Validando resolução de targets (Bairro = Santos Dumont)");
    const preview = await resolveNotificationTargets({
      targetType: "NEIGHBORHOOD",
      targetFilters: { neighborhoods: ["Santos Dumont"] }
    });

    const containsA = preview.users.some(u => String(u._id) === String(userA._id));
    const containsB = preview.users.some(u => String(u._id) === String(userB._id));
    const containsC = preview.users.some(u => String(u._id) === String(userC._id));
    
    const hasOnlyTokenA = preview.tokens.length === 1 && preview.tokens[0] === "ExponentPushToken[AUDIT_A]";

    if (containsA && !containsB && !containsC && hasOnlyTokenA) {
      console.log("🟢 OK: resolveNotificationTargets encontrou o Usuário A (e omitiu B e C) e derivou apenas tokenA.");
    } else {
      console.error("🔴 FALHA: Resolução de targets incorreta.");
      console.error("Esperado: apenas Usuário A e tokenA.");
      console.error("Obtido usuários:", preview.users.map(u => u.name));
      console.error("Obtido tokens:", preview.tokens);
    }

  } catch (error) {
    console.error("Erro durante a execução do script de teste:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nConexão com o banco de dados encerrada.");
  }
}

run();
