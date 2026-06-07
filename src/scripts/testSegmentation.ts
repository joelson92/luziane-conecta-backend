import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Post } from "../models/Post.js";
import { matchesAudience } from "../utils/audience.js";
import { resolveNotificationTargets } from "../services/notificationTargetService.js";

async function run() {
  console.log("=== INICIANDO TESTE DE SEGMENTAÇÃO DEFINITIVA ===");
  
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    // 1. Criar ou atualizar os 3 usuários de teste
    // Usuário A: Centro, cidadao
    let userA = await User.findOne({ email: "user_a@luziane.com" });
    if (!userA) {
      userA = await User.create({
        name: "Usuário A (Centro, Cidadão)",
        email: "user_a@luziane.com",
        passwordHash: "dummy",
        role: "CIDADAO",
        neighborhood: "Centro",
        neighborhoodName: "Centro",
        isActive: true,
        expoPushToken: "ExponentPushToken[TEST_TOKEN_A]"
      });
    } else {
      userA.neighborhood = "Centro";
      userA.neighborhoodName = "Centro";
      userA.role = "CIDADAO";
      userA.isActive = true;
      userA.set("expoPushToken", "ExponentPushToken[TEST_TOKEN_A]");
      await userA.save();
    }

    // Usuário B: Maguari, cidadao
    let userB = await User.findOne({ email: "user_b@luziane.com" });
    if (!userB) {
      userB = await User.create({
        name: "Usuário B (Maguari, Cidadão)",
        email: "user_b@luziane.com",
        passwordHash: "dummy",
        role: "CIDADAO",
        neighborhood: "Maguari",
        neighborhoodName: "Maguari",
        isActive: true,
        expoPushToken: "ExponentPushToken[TEST_TOKEN_B]"
      });
    } else {
      userB.neighborhood = "Maguari";
      userB.neighborhoodName = "Maguari";
      userB.role = "CIDADAO";
      userB.isActive = true;
      userB.set("expoPushToken", "ExponentPushToken[TEST_TOKEN_B]");
      await userB.save();
    }

    // Usuário C: Centro, lideranca (PREFEITA)
    let userC = await User.findOne({ email: "user_c@luziane.com" });
    if (!userC) {
      userC = await User.create({
        name: "Usuário C (Centro, Liderança)",
        email: "user_c@luziane.com",
        passwordHash: "dummy",
        role: "PREFEITA",
        neighborhood: "Centro",
        neighborhoodName: "Centro",
        isActive: true,
        expoPushToken: "ExponentPushToken[TEST_TOKEN_C]"
      });
    } else {
      userC.neighborhood = "Centro";
      userC.neighborhoodName = "Centro";
      userC.role = "PREFEITA";
      userC.isActive = true;
      userC.set("expoPushToken", "ExponentPushToken[TEST_TOKEN_C]");
      await userC.save();
    }

    console.log("\n--- Usuários carregados para o teste ---");
    console.log("User A:", { id: userA._id, neighborhood: userA.neighborhood, role: userA.role });
    console.log("User B:", { id: userB._id, neighborhood: userB.neighborhood, role: userB.role });
    console.log("User C:", { id: userC._id, neighborhood: userC.neighborhood, role: userC.role });

    // --- TESTES DE PUSH NOTIFICATIONS ---
    console.log("\n=================== TESTE DE PUSH NOTIFICATIONS (resolveNotificationTargets) ===================");

    // Teste 1: Enviar para bairro Centro
    console.log("\n--> Executando Cenário 1: Enviar para bairro Centro");
    const payloadCentro = {
      audienceType: "segmented",
      targetNeighborhoods: ["Centro"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    };
    const resCentro = await resolveNotificationTargets(payloadCentro);
    const hasA_Centro = resCentro.users.some(u => String(u._id) === String(userA._id));
    const hasB_Centro = resCentro.users.some(u => String(u._id) === String(userB._id));
    const hasC_Centro = resCentro.users.some(u => String(u._id) === String(userC._id));
    console.log(`Resultado Cenário 1: A recebe? ${hasA_Centro} (Esp: true) | B recebe? ${hasB_Centro} (Esp: false) | C recebe? ${hasC_Centro} (Esp: true)`);
    if (hasA_Centro && !hasB_Centro && hasC_Centro) {
      console.log("Cenário 1: SUCESSO");
    } else {
      console.error("Cenário 1: FALHA");
    }

    // Teste 2: Enviar para bairro Maguari
    console.log("\n--> Executando Cenário 2: Enviar para bairro Maguari");
    const payloadMaguari = {
      audienceType: "segmented",
      targetNeighborhoods: ["Maguari"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    };
    const resMaguari = await resolveNotificationTargets(payloadMaguari);
    const hasA_Mag = resMaguari.users.some(u => String(u._id) === String(userA._id));
    const hasB_Mag = resMaguari.users.some(u => String(u._id) === String(userB._id));
    const hasC_Mag = resMaguari.users.some(u => String(u._id) === String(userC._id));
    console.log(`Resultado Cenário 2: A recebe? ${hasA_Mag} (Esp: false) | B recebe? ${hasB_Mag} (Esp: true) | C recebe? ${hasC_Mag} (Esp: false)`);
    if (!hasA_Mag && hasB_Mag && !hasC_Mag) {
      console.log("Cenário 2: SUCESSO");
    } else {
      console.error("Cenário 2: FALHA");
    }

    // Teste 3: Enviar para bairro Centro + role lideranca
    console.log("\n--> Executando Cenário 3: Enviar para bairro Centro + role lideranca");
    const payloadCentroLider = {
      audienceType: "segmented",
      targetNeighborhoods: ["Centro"],
      targetCommunities: [],
      targetRoles: ["lideranca"],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    };
    const resCentroLider = await resolveNotificationTargets(payloadCentroLider);
    const hasA_CL = resCentroLider.users.some(u => String(u._id) === String(userA._id));
    const hasB_CL = resCentroLider.users.some(u => String(u._id) === String(userB._id));
    const hasC_CL = resCentroLider.users.some(u => String(u._id) === String(userC._id));
    console.log(`Resultado Cenário 3: A recebe? ${hasA_CL} (Esp: false) | B recebe? ${hasB_CL} (Esp: false) | C recebe? ${hasC_CL} (Esp: true)`);
    if (!hasA_CL && !hasB_CL && hasC_CL) {
      console.log("Cenário 3: SUCESSO");
    } else {
      console.error("Cenário 3: FALHA");
    }

    // --- TESTES DE VISUALIZAÇÃO DE COMUNICADOS ---
    console.log("\n=================== TESTE DE VISUALIZAÇÃO DE COMUNICADOS (matchesAudience) ===================");

    // Teste 4: Enviar comunicado para bairro Centro
    console.log("\n--> Executando Cenário 4: Enviar comunicado para bairro Centro");
    const comunicadoCentro = {
      audienceType: "segmented",
      targetNeighborhoods: ["Centro"],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    };
    const visA_Centro = matchesAudience(userA, comunicadoCentro);
    const visB_Centro = matchesAudience(userB, comunicadoCentro);
    const visC_Centro = matchesAudience(userC, comunicadoCentro);
    console.log(`Resultado Cenário 4: A visualiza? ${visA_Centro} (Esp: true) | B visualiza? ${visB_Centro} (Esp: false) | C visualiza? ${visC_Centro} (Esp: true)`);
    if (visA_Centro && !visB_Centro && visC_Centro) {
      console.log("Cenário 4: SUCESSO");
    } else {
      console.error("Cenário 4: FALHA");
    }

    // Teste 5: Enviar comunicado para todos
    console.log("\n--> Executando Cenário 5: Enviar comunicado para todos");
    const comunicadoTodos = {
      audienceType: "all",
      targetNeighborhoods: [],
      targetCommunities: [],
      targetRoles: [],
      targetProfiles: [],
      targetInterests: [],
      targetUserIds: []
    };
    const visA_Todos = matchesAudience(userA, comunicadoTodos);
    const visB_Todos = matchesAudience(userB, comunicadoTodos);
    const visC_Todos = matchesAudience(userC, comunicadoTodos);
    console.log(`Resultado Cenário 5: A visualiza? ${visA_Todos} (Esp: true) | B visualiza? ${visB_Todos} (Esp: true) | C visualiza? ${visC_Todos} (Esp: true)`);
    if (visA_Todos && visB_Todos && visC_Todos) {
      console.log("Cenário 5: SUCESSO");
    } else {
      console.error("Cenário 5: FALHA");
    }

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
