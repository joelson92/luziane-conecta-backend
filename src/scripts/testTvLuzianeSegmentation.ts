import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Video } from "../models/Video.js";
import { canUserAccessContent } from "../utils/audience.js";

async function run() {
  console.log("=== INICIANDO TESTE DE SEGMENTAÇÃO DE VÍDEOS (TV LUZIANE) ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    // 1. Configurar usuários de teste
    const dateA = new Date();
    dateA.setFullYear(dateA.getFullYear() - 25);

    let userA = await User.findOne({ email: "test_tv_a@luziane.com" });
    const uDataA = {
      name: "Usuário A (Citizen, Duque de Caxias, Comunidade A, morador, saude, 25 anos)",
      email: "test_tv_a@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      community: "Comunidade A",
      profile: "morador",
      interests: ["saude"],
      birthDate: dateA,
      isActive: true,
      expoPushToken: "ExponentPushToken[TEST_TV_TOKEN_A]"
    };
    if (!userA) {
      userA = await User.create(uDataA);
    } else {
      Object.assign(userA, uDataA);
      await userA.save();
    }

    const dateB = new Date();
    dateB.setFullYear(dateB.getFullYear() - 45);

    let userB = await User.findOne({ email: "test_tv_b@luziane.com" });
    const uDataB = {
      name: "Usuário B (Super Admin, Duque de Caxias, Comunidade B, admin, gestao, 45 anos)",
      email: "test_tv_b@luziane.com",
      passwordHash: "dummy",
      role: "SUPER_ADMIN",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      community: "Comunidade B",
      profile: "admin",
      interests: ["gestao"],
      birthDate: dateB,
      isActive: true,
      expoPushToken: "ExponentPushToken[TEST_TV_TOKEN_B]"
    };
    if (!userB) {
      userB = await User.create(uDataB);
    } else {
      Object.assign(userB, uDataB);
      await userB.save();
    }

    const dateC = new Date();
    dateC.setFullYear(dateC.getFullYear() - 15);

    let userC = await User.findOne({ email: "test_tv_c@luziane.com" });
    const uDataC = {
      name: "Usuário C (Citizen, Benfica, Comunidade B, morador, educacao, 15 anos)",
      email: "test_tv_c@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Benfica",
      neighborhoodName: "Benfica",
      community: "Comunidade B",
      profile: "morador",
      interests: ["educacao"],
      birthDate: dateC,
      isActive: true,
      expoPushToken: "ExponentPushToken[TEST_TV_TOKEN_C]"
    };
    if (!userC) {
      userC = await User.create(uDataC);
    } else {
      Object.assign(userC, uDataC);
      await userC.save();
    }

    // 2. Configurar vídeos de teste
    // Video 1: ALL
    const v1 = new Video({
      title: "Vídeo Todos",
      description: "Vídeo aberto a todos",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "ALL"
    });

    // Video 2: NEIGHBORHOOD - Duque de Caxias e Benfica
    const v2 = new Video({
      title: "Vídeo Bairros",
      description: "Vídeo para Duque de Caxias e Benfica",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "NEIGHBORHOOD",
      targetNeighborhoods: ["Duque de Caxias", "Benfica"]
    });

    // Video 3: COMMUNITY - Comunidade A
    const v3 = new Video({
      title: "Vídeo Comunidade A",
      description: "Vídeo para Comunidade A",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "COMMUNITY",
      targetCommunities: ["Comunidade A"]
    });

    // Video 4: ROLE - CIDADAO
    const v4 = new Video({
      title: "Vídeo Cidadão",
      description: "Vídeo para cidadãos",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "ROLE",
      targetRoles: ["CIDADAO"]
    });

    // Video 5: PROFILE - morador
    const v5 = new Video({
      title: "Vídeo Morador",
      description: "Vídeo para perfil morador",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "PROFILE",
      targetProfiles: ["morador"]
    });

    // Video 6: INTERESTS - saude
    const v6 = new Video({
      title: "Vídeo Saúde",
      description: "Vídeo sobre saúde",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "INTERESTS",
      targetInterests: ["saude"]
    });

    // Video 7: SPECIFIC_USERS - User C
    const v7 = new Video({
      title: "Vídeo para User C",
      description: "Vídeo privado para User C",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "SPECIFIC_USERS",
      targetUserIds: [userC._id]
    });

    // Video 8: AGE_RANGE - (18 a 35)
    const v8 = new Video({
      title: "Vídeo Adultos Jovens",
      description: "Vídeo para faixa etária 18-35",
      sourceType: "upload",
      platform: "upload",
      status: "published",
      targetType: "AGE_RANGE",
      targetAgeRange: { min: 18, max: 35 }
    });

    const videos = [v1, v2, v3, v4, v5, v6, v7, v8];

    // Trigger validation / pre-validate triggers to map arrays correctly
    for (const v of videos) {
      await v.validate();
    }

    console.log("\nVídeos de teste validados.");

    let testsFailed = 0;

    const assertAccess = (user: any, video: any, expectedAllowed: boolean, testName: string) => {
      console.log(`\n--- Testando acesso: ${testName} ---`);
      const actualAllowed = canUserAccessContent(user, video);
      if (actualAllowed === expectedAllowed) {
        console.log(`🟢 PASSED: ${testName}`);
      } else {
        console.error(`🔴 FAILED: ${testName} - Esperava: ${expectedAllowed}, Recebeu: ${actualAllowed}`);
        testsFailed++;
      }
    };

    // User A (Citizen, Duque de Caxias, Comunidade A, morador, saude, 25 anos)
    // Elegível para:
    // - v1 (ALL) - SIM
    // - v2 (NEIGHBORHOOD: Duque de Caxias, Benfica) - SIM
    // - v3 (COMMUNITY: Comunidade A) - SIM
    // - v4 (ROLE: CIDADAO) - SIM
    // - v5 (PROFILE: morador) - SIM
    // - v6 (INTERESTS: saude) - SIM
    // - v7 (SPECIFIC_USERS: C) - NÃO
    // - v8 (AGE_RANGE: 18-35) - SIM
    assertAccess(userA, v1, true, "User A acessa ALL");
    assertAccess(userA, v2, true, "User A acessa NEIGHBORHOOD");
    assertAccess(userA, v3, true, "User A acessa COMMUNITY");
    assertAccess(userA, v4, true, "User A acessa ROLE");
    assertAccess(userA, v5, true, "User A acessa PROFILE");
    assertAccess(userA, v6, true, "User A acessa INTERESTS");
    assertAccess(userA, v7, false, "User A não acessa SPECIFIC_USERS");
    assertAccess(userA, v8, true, "User A acessa AGE_RANGE");

    // User B (Super Admin, Duque de Caxias, Comunidade B, admin, gestao, 45 anos)
    // Elegível para:
    // - v1 (ALL) - SIM
    // - v2 (NEIGHBORHOOD: Duque de Caxias, Benfica) - SIM (bairro coincide)
    // - v3 (COMMUNITY: Comunidade A) - NÃO
    // - v4 (ROLE: CIDADAO) - NÃO
    // - v5 (PROFILE: morador) - NÃO
    // - v6 (INTERESTS: saude) - NÃO
    // - v7 (SPECIFIC_USERS: C) - NÃO
    // - v8 (AGE_RANGE: 18-35) - NÃO (45 anos)
    assertAccess(userB, v1, true, "User B acessa ALL");
    assertAccess(userB, v2, true, "User B acessa NEIGHBORHOOD");
    assertAccess(userB, v3, false, "User B não acessa COMMUNITY");
    assertAccess(userB, v4, false, "User B não acessa ROLE");
    assertAccess(userB, v5, false, "User B não acessa PROFILE");
    assertAccess(userB, v6, false, "User B não acessa INTERESTS");
    assertAccess(userB, v7, false, "User B não acessa SPECIFIC_USERS");
    assertAccess(userB, v8, false, "User B não acessa AGE_RANGE");

    // User C (Citizen, Benfica, Comunidade B, morador, educacao, 15 anos)
    // Elegível para:
    // - v1 (ALL) - SIM
    // - v2 (NEIGHBORHOOD: Duque de Caxias, Benfica) - SIM (bairro coincide)
    // - v3 (COMMUNITY: Comunidade A) - NÃO
    // - v4 (ROLE: CIDADAO) - SIM
    // - v5 (PROFILE: morador) - SIM
    // - v6 (INTERESTS: saude) - NÃO (tem educacao)
    // - v7 (SPECIFIC_USERS: C) - SIM
    // - v8 (AGE_RANGE: 18-35) - NÃO (15 anos)
    assertAccess(userC, v1, true, "User C acessa ALL");
    assertAccess(userC, v2, true, "User C acessa NEIGHBORHOOD");
    assertAccess(userC, v3, false, "User C não acessa COMMUNITY");
    assertAccess(userC, v4, true, "User C acessa ROLE");
    assertAccess(userC, v5, true, "User C acessa PROFILE");
    assertAccess(userC, v6, false, "User C não acessa INTERESTS");
    assertAccess(userC, v7, true, "User C acessa SPECIFIC_USERS");
    assertAccess(userC, v8, false, "User C não acessa AGE_RANGE");

    if (testsFailed === 0) {
      console.log("\n🟢 TODOS OS TESTES DE SEGMENTAÇÃO DE VÍDEO PASSARAM COM SUCESSO!");
    } else {
      console.error(`\n🔴 FALHA: ${testsFailed} teste(s) de segmentação de vídeo falhou/falharam.`);
      process.exit(1);
    }

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
