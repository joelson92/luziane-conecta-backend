import mongoose from "mongoose";
import { User } from "../models/User.js";
import { resolveNotificationTargets } from "../services/notificationTargetService.js";

async function run() {
  console.log("=== INICIANDO TESTE COMPLETO DE TODAS AS SEGMENTAÇÕES DE NOTIFICAÇÕES ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    // 1. Configurar usuários de teste
    // Usuário A: role = CIDADAO, bairro = Duque de Caxias, community = Comunidade A, profile = morador, interests = ["saude"], tokenA, age = 25
    const dateA = new Date();
    dateA.setFullYear(dateA.getFullYear() - 25);

    let userA = await User.findOne({ email: "test_all_a@luziane.com" });
    const uDataA = {
      name: "Usuário A (Citizen, Duque de Caxias, Comunidade A, morador, saude, 25 anos)",
      email: "test_all_a@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      community: "Comunidade A",
      profile: "morador",
      interests: ["saude"],
      birthDate: dateA,
      isActive: true,
      expoPushToken: "ExponentPushToken[TEST_TOKEN_ALL_A]"
    };
    if (!userA) {
      userA = await User.create(uDataA);
    } else {
      Object.assign(userA, uDataA);
      await userA.save();
    }

    // Usuário B: role = SUPER_ADMIN, bairro = Duque de Caxias, community = Comunidade B, profile = admin, interests = ["gestao"], tokenB, age = 45
    const dateB = new Date();
    dateB.setFullYear(dateB.getFullYear() - 45);

    let userB = await User.findOne({ email: "test_all_b@luziane.com" });
    const uDataB = {
      name: "Usuário B (Super Admin, Duque de Caxias, Comunidade B, admin, gestao, 45 anos)",
      email: "test_all_b@luziane.com",
      passwordHash: "dummy",
      role: "SUPER_ADMIN",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      community: "Comunidade B",
      profile: "admin",
      interests: ["gestao"],
      birthDate: dateB,
      isActive: true,
      expoPushToken: "ExponentPushToken[TEST_TOKEN_ALL_B]"
    };
    if (!userB) {
      userB = await User.create(uDataB);
    } else {
      Object.assign(userB, uDataB);
      await userB.save();
    }

    // Usuário C: role = CIDADAO, bairro = Benfica, community = Comunidade B, profile = morador, interests = ["educacao"], tokenC, age = 15
    const dateC = new Date();
    dateC.setFullYear(dateC.getFullYear() - 15);

    let userC = await User.findOne({ email: "test_all_c@luziane.com" });
    const uDataC = {
      name: "Usuário C (Citizen, Benfica, Comunidade B, morador, educacao, 15 anos)",
      email: "test_all_c@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Benfica",
      neighborhoodName: "Benfica",
      community: "Comunidade B",
      profile: "morador",
      interests: ["educacao"],
      birthDate: dateC,
      isActive: true,
      expoPushToken: "ExponentPushToken[TEST_TOKEN_ALL_C]"
    };
    if (!userC) {
      userC = await User.create(uDataC);
    } else {
      Object.assign(userC, uDataC);
      await userC.save();
    }

    console.log("\nUsuários de teste carregados com sucesso:");
    console.log("A:", { id: userA._id, role: userA.role, neighborhood: userA.neighborhood, community: userA.community, profile: userA.profile, interests: userA.interests });
    console.log("B:", { id: userB._id, role: userB.role, neighborhood: userB.neighborhood, community: userB.community, profile: userB.profile, interests: userB.interests });
    console.log("C:", { id: userC._id, role: userC.role, neighborhood: userC.neighborhood, community: userC.community, profile: userC.profile, interests: userC.interests });

    // Usuário D: sem token
    let userD = await User.findOne({ email: "test_all_d@luziane.com" });
    const uDataD = {
      name: "Usuário D (Sem token)",
      email: "test_all_d@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      isActive: true,
      expoPushToken: undefined,
      pushToken: undefined,
      pushTokens: []
    };
    if (!userD) {
      userD = await User.create(uDataD);
    } else {
      Object.assign(userD, uDataD);
      userD.expoPushToken = undefined;
      userD.pushToken = undefined;
      userD.pushTokens = [];
      await userD.save();
    }

    // Usuário E: token duplicado
    let userE = await User.findOne({ email: "test_all_e@luziane.com" });
    const uDataE = {
      name: "Usuário E (Token duplo)",
      email: "test_all_e@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      neighborhood: "Duque de Caxias",
      neighborhoodName: "Duque de Caxias",
      isActive: true,
      expoPushToken: "ExponentPushToken[DUP]",
      pushToken: "ExponentPushToken[DUP]",
      pushTokens: ["ExponentPushToken[DUP]"]
    };
    if (!userE) {
      userE = await User.create(uDataE);
    } else {
      Object.assign(userE, uDataE);
      await userE.save();
    }

    let testsFailed = 0;

    // Helper de assert
    const assertTest = (scenarioName: string, actualUsers: any[], expectedUsers: any[], expectedTokens: string[]) => {
      const actualIds = actualUsers.map(u => String(u._id)).sort();
      const expectedIds = expectedUsers.map(u => String(u._id)).sort();
      const isIdsMatch = JSON.stringify(actualIds) === JSON.stringify(expectedIds);

      const actualTokens = actualUsers.flatMap(u => u.expoPushToken ? [u.expoPushToken] : []).sort();
      const expectedTokensSorted = [...expectedTokens].sort();
      const isTokensMatch = JSON.stringify(actualTokens) === JSON.stringify(expectedTokensSorted);

      console.log(`\n--> Cenário: ${scenarioName}`);
      console.log(`    Recipients encontrados: [${actualUsers.map(u => u.name.split(" ")[1]).join(", ")}]`);
      console.log(`    Tokens derivados: [${actualTokens.join(", ")}]`);

      if (isIdsMatch && isTokensMatch) {
        console.log(`    🟢 SUCESSO`);
      } else {
        console.error(`    🔴 FALHA!`);
        console.error(`       Esperado IDs: [${expectedIds.join(", ")}], Obtido: [${actualIds.join(", ")}]`);
        console.error(`       Esperado Tokens: [${expectedTokensSorted.join(", ")}], Obtido: [${actualTokens.join(", ")}]`);
        testsFailed++;
      }
    };

    // 1. Teste: ROLE CIDADAO
    const resRoleCidadao = await resolveNotificationTargets({
      targetType: "ROLE",
      targetFilters: { roles: ["CIDADAO"] }
    });
    // Deve incluir A e C, não B.
    assertTest("1. ROLE CIDADAO", resRoleCidadao.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA, userC], ["ExponentPushToken[TEST_TOKEN_ALL_A]", "ExponentPushToken[TEST_TOKEN_ALL_C]"]);

    // Teste alternativo para ROLE usando singular "role"
    const resRoleSingular = await resolveNotificationTargets({
      targetType: "ROLE",
      targetFilters: { role: "CIDADAO" }
    });
    assertTest("1b. ROLE CIDADAO (singular)", resRoleSingular.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA, userC], ["ExponentPushToken[TEST_TOKEN_ALL_A]", "ExponentPushToken[TEST_TOKEN_ALL_C]"]);

    // 2. Teste: ROLE SUPER_ADMIN
    const resRoleAdmin = await resolveNotificationTargets({
      targetType: "ROLE",
      targetFilters: { roles: ["SUPER_ADMIN"] }
    });
    assertTest("2. ROLE SUPER_ADMIN", resRoleAdmin.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userB], ["ExponentPushToken[TEST_TOKEN_ALL_B]"]);

    // 3. Teste: COMMUNITY Comunidade A
    const resComm = await resolveNotificationTargets({
      targetType: "COMMUNITY",
      targetFilters: { communities: ["Comunidade A"] }
    });
    assertTest("3. COMMUNITY Comunidade A", resComm.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA], ["ExponentPushToken[TEST_TOKEN_ALL_A]"]);

    // Teste alternativo para COMMUNITY usando singular "community"
    const resCommSingular = await resolveNotificationTargets({
      targetType: "COMMUNITY",
      targetFilters: { community: "Comunidade A" }
    });
    assertTest("3b. COMMUNITY Comunidade A (singular)", resCommSingular.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA], ["ExponentPushToken[TEST_TOKEN_ALL_A]"]);

    // 4. Teste: PROFILE morador
    const resProfile = await resolveNotificationTargets({
      targetType: "PROFILE",
      targetFilters: { profiles: ["morador"] }
    });
    assertTest("4. PROFILE morador", resProfile.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA, userC], ["ExponentPushToken[TEST_TOKEN_ALL_A]", "ExponentPushToken[TEST_TOKEN_ALL_C]"]);

    // 5. Teste: INTERESTS saude
    const resInterests = await resolveNotificationTargets({
      targetType: "INTERESTS",
      targetFilters: { interests: ["saude"] }
    });
    assertTest("5. INTERESTS saude", resInterests.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA], ["ExponentPushToken[TEST_TOKEN_ALL_A]"]);

    // 6. Teste: SPECIFIC_USERS [C]
    const resSpecific = await resolveNotificationTargets({
      targetType: "SPECIFIC_USERS",
      targetFilters: { userIds: [String(userC._id)] }
    });
    assertTest("6. SPECIFIC_USERS [C]", resSpecific.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id) || String(u._id) === String(userD._id) || String(u._id) === String(userE._id)), [userC], ["ExponentPushToken[TEST_TOKEN_ALL_C]"]);

    // 7. Teste: AGE_RANGE (minAge: 18, maxAge: 35) - deve conter apenas A
    const resAge = await resolveNotificationTargets({
      targetType: "AGE_RANGE",
      targetFilters: { minAge: 18, maxAge: 35 }
    });
    assertTest("7. AGE_RANGE (18-35)", resAge.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [userA], ["ExponentPushToken[TEST_TOKEN_ALL_A]"]);

    // 8. Teste: Filtros vazios para segmentação (não deve dar fallback para ALL)
    const resEmpty = await resolveNotificationTargets({
      targetType: "ROLE",
      targetFilters: { roles: [] }
    });
    assertTest("8. Filtros vazios (sem fallback)", resEmpty.users.filter(u => String(u._id) === String(userA._id) || String(u._id) === String(userB._id) || String(u._id) === String(userC._id)), [], []);

    // 9. Teste: Usuário sem token (D)
    const resNoToken = await resolveNotificationTargets({
      targetType: "SPECIFIC_USERS",
      targetFilters: { userIds: [String(userD._id)] }
    });
    assertTest("9. Usuário sem token", resNoToken.users.filter(u => String(u._id) === String(userD._id)), [userD], []);

    // 10. Teste: Usuário com token duplicado (E)
    const resDupToken = await resolveNotificationTargets({
      targetType: "SPECIFIC_USERS",
      targetFilters: { userIds: [String(userE._id)] }
    });
    assertTest("10. Usuário token duplicado", resDupToken.users.filter(u => String(u._id) === String(userE._id)), [userE], ["ExponentPushToken[DUP]"]);

    if (testsFailed === 0) {
      console.log("\n🟢 TODOS OS TESTES PASSARAM COM SUCESSO!");
    } else {
      console.error(`\n🔴 FALHA: ${testsFailed} teste(s) falhou/falharam.`);
    }

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
