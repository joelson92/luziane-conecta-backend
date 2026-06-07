import mongoose from "mongoose";
import { User } from "../models/User.js";
import { resolveNotificationTargets } from "../services/notificationTargetService.js";

async function run() {
  console.log("=== TESTE DE AUDITORIA DE NOTIFICAÇÕES ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.\n");

  try {
    // 1. Criar/garantir usuários de teste com push tokens
    const testUsers = [
      {
        email: "notify_centro@luziane.com",
        name: "Usuário Notif Centro",
        neighborhood: "Centro",
        neighborhoodName: "Centro",
        role: "CIDADAO",
        expoPushToken: "ExponentPushToken[FAKE_TOKEN_CENTRO_001]"
      },
      {
        email: "notify_bengolandia@luziane.com",
        name: "Usuário Notif Bengolândia",
        neighborhood: "Bengolândia",
        neighborhoodName: "Bengolândia",
        role: "CIDADAO",
        expoPushToken: "ExponentPushToken[FAKE_TOKEN_BENGO_001]"
      },
      {
        email: "notify_duque@luziane.com",
        name: "Usuário Notif Duque de Caxias",
        neighborhood: "Duque de Caxias",
        neighborhoodName: "Duque de Caxias",
        role: "CIDADAO",
        expoPushToken: "ExponentPushToken[FAKE_TOKEN_DUQUE_001]"
      }
    ];

    const savedUsers: any[] = [];
    for (const u of testUsers) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({ ...u, passwordHash: "dummy_hash", isActive: true });
        console.log(`✅ Criado: ${u.email}`);
      } else {
        user.neighborhood = u.neighborhood;
        user.neighborhoodName = u.neighborhoodName;
        user.role = u.role as any;
        user.set("expoPushToken", u.expoPushToken);
        user.isActive = true;
        await user.save();
        console.log(`✅ Atualizado: ${u.email}`);
      }
      savedUsers.push(user);
    }

    const [userCentro, userBengo, userDuque] = savedUsers;

    console.log("\n=== INICIANDO TESTES DE SEGMENTAÇÃO ===\n");

    // ──────────────────────────────────────────
    // Cenário 1: Todos os usuários
    // ──────────────────────────────────────────
    console.log("──────────────────────────────────────────");
    console.log("Cenário 1: Todos os usuários");
    const result1 = await resolveNotificationTargets({
      audienceType: "all",
      targetNeighborhoods: [],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    });
    const c1_centro = result1.users.some((u: any) => String(u._id) === String(userCentro._id));
    const c1_bengo  = result1.users.some((u: any) => String(u._id) === String(userBengo._id));
    const c1_duque  = result1.users.some((u: any) => String(u._id) === String(userDuque._id));
    console.log(`  Centro recebe? ${c1_centro} (Esp: true) | Bengolândia recebe? ${c1_bengo} (Esp: true) | Duque recebe? ${c1_duque} (Esp: true)`);
    console.log(`  Total destinatários: ${result1.totalRecipients} (>= 3 esperado)`);
    console.log(`  Cenário 1: ${c1_centro && c1_bengo && c1_duque && result1.totalRecipients >= 3 ? "✅ SUCESSO" : "❌ FALHOU"}\n`);

    // ──────────────────────────────────────────
    // Cenário 2: Bairro Centro
    // ──────────────────────────────────────────
    console.log("──────────────────────────────────────────");
    console.log("Cenário 2: Bairro Centro");
    const result2 = await resolveNotificationTargets({
      audienceType: "segmented",
      targetNeighborhoods: ["Centro"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    });
    const c2_centro = result2.users.some((u: any) => String(u._id) === String(userCentro._id));
    const c2_bengo  = result2.users.some((u: any) => String(u._id) === String(userBengo._id));
    const c2_duque  = result2.users.some((u: any) => String(u._id) === String(userDuque._id));
    console.log(`  Centro recebe? ${c2_centro} (Esp: true) | Bengolândia recebe? ${c2_bengo} (Esp: false) | Duque recebe? ${c2_duque} (Esp: false)`);
    console.log(`  Cenário 2: ${c2_centro && !c2_bengo && !c2_duque ? "✅ SUCESSO" : "❌ FALHOU"}\n`);

    // ──────────────────────────────────────────
    // Cenário 3: Bairro Bengolândia
    // ──────────────────────────────────────────
    console.log("──────────────────────────────────────────");
    console.log("Cenário 3: Bairro Bengolândia");
    const result3 = await resolveNotificationTargets({
      audienceType: "segmented",
      targetNeighborhoods: ["Bengolândia"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    });
    const c3_centro = result3.users.some((u: any) => String(u._id) === String(userCentro._id));
    const c3_bengo  = result3.users.some((u: any) => String(u._id) === String(userBengo._id));
    const c3_duque  = result3.users.some((u: any) => String(u._id) === String(userDuque._id));
    console.log(`  Centro recebe? ${c3_centro} (Esp: false) | Bengolândia recebe? ${c3_bengo} (Esp: true) | Duque recebe? ${c3_duque} (Esp: false)`);
    console.log(`  Cenário 3: ${!c3_centro && c3_bengo && !c3_duque ? "✅ SUCESSO" : "❌ FALHOU"}\n`);

    // ──────────────────────────────────────────
    // Cenário 4: Bairro Duque de Caxias
    // ──────────────────────────────────────────
    console.log("──────────────────────────────────────────");
    console.log("Cenário 4: Bairro Duque de Caxias");
    const result4 = await resolveNotificationTargets({
      audienceType: "segmented",
      targetNeighborhoods: ["Duque de Caxias"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    });
    const c4_centro = result4.users.some((u: any) => String(u._id) === String(userCentro._id));
    const c4_bengo  = result4.users.some((u: any) => String(u._id) === String(userBengo._id));
    const c4_duque  = result4.users.some((u: any) => String(u._id) === String(userDuque._id));
    console.log(`  Centro recebe? ${c4_centro} (Esp: false) | Bengolândia recebe? ${c4_bengo} (Esp: false) | Duque recebe? ${c4_duque} (Esp: true)`);
    console.log(`  Cenário 4: ${!c4_centro && !c4_bengo && c4_duque ? "✅ SUCESSO" : "❌ FALHOU"}\n`);

    // ──────────────────────────────────────────
    // Cenário 5: Bairro inexistente
    // ──────────────────────────────────────────
    console.log("──────────────────────────────────────────");
    console.log("Cenário 5: Bairro inexistente");
    const result5 = await resolveNotificationTargets({
      audienceType: "segmented",
      targetNeighborhoods: ["Bairro Que Nao Existe XYZ"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    });
    console.log(`  Total destinatários: ${result5.totalRecipients} (0 esperado)`);
    console.log(`  Cenário 5 (no_recipients): ${result5.totalRecipients === 0 ? "✅ SUCESSO" : "❌ FALHOU"}\n`);

    // ──────────────────────────────────────────
    // Verificar campo fcmToken dos usuários reais
    // ──────────────────────────────────────────
    console.log("──────────────────────────────────────────");
    console.log("Verificação: usuários reais com token no banco");
    const usersWithToken = await User.find({
      isActive: true,
      $or: [
        { fcmToken: { $exists: true, $nin: [null, ""] } },
        { fcmTokens: { $exists: true, $not: { $size: 0 } } }
      ]
    }).select("name email neighborhood fcmToken").lean();

    console.log(`  Total usuários ativos com token: ${usersWithToken.length}`);
    for (const u of usersWithToken) {
      const token = (u as any).fcmToken || "—";
      console.log(`  - ${(u as any).name} (${(u as any).neighborhood}): ${token.slice(0, 50)}...`);
    }

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
