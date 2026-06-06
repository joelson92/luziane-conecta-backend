import mongoose from "mongoose";
import { User } from "../models/User.js";
import {
  createUser,
  deleteUserPermanent,
  resetUserPassword,
  validatePasswordStrength
} from "../controllers/userController.js";

async function executeController(fn: any, req: any, res: any) {
  return new Promise<any>((resolve, reject) => {
    res.json = (data: any) => {
      res.jsonData = data;
      resolve(data);
    };
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    const next = (err?: any) => {
      if (err) reject(err);
      else resolve(null);
    };
    fn(req, res, next);
  });
}

async function run() {
  console.log("=== INICIANDO TESTE DE GESTÃO E EXCLUSÃO DE USUÁRIOS ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    // Teste 1: Validação de força de senha
    console.log("\n--> 1. Testando validação de força de senha...");
    const testPasswords = [
      { pwd: "Short1!", valid: false, reason: "Curta" },
      { pwd: "nocapital123!", valid: false, reason: "Sem maiúscula" },
      { pwd: "NOLOWER123!", valid: false, reason: "Sem minúscula" },
      { pwd: "NoNumber!@#$%", valid: false, reason: "Sem número" },
      { pwd: "NoSpecial1234", valid: false, reason: "Sem especial" },
      { pwd: "StrongPassword@123", valid: true, reason: "Válida" }
    ];

    for (const item of testPasswords) {
      try {
        validatePasswordStrength(item.pwd);
        console.log(`Senha "${item.pwd}": Válida (Esperado: ${item.valid})`);
      } catch (err: any) {
        console.log(`Senha "${item.pwd}": Inválida - ${err.message} (Esperado: ${item.valid ? "válido" : "inválido"})`);
      }
    }

    // 2. Preparar usuários no banco para testes de controle
    // Superadmin A
    let adminUser = await User.findOne({ email: "test_super@luziane.com" });
    if (!adminUser) {
      adminUser = await User.create({
        name: "Test SuperAdmin",
        email: "test_super@luziane.com",
        passwordHash: "dummy",
        role: "SUPER_ADMIN",
        isActive: true
      });
    }

    // Assessor B
    let assessorUser = await User.findOne({ email: "test_assessor@luziane.com" });
    if (!assessorUser) {
      assessorUser = await User.create({
        name: "Test Assessor",
        email: "test_assessor@luziane.com",
        passwordHash: "dummy",
        role: "ASSESSOR",
        isActive: true
      });
    }

    // Cidadão C
    let citizenUser = await User.findOne({ email: "test_citizen@luziane.com" });
    if (!citizenUser) {
      citizenUser = await User.create({
        name: "Test Citizen",
        email: "test_citizen@luziane.com",
        passwordHash: "dummy",
        role: "CIDADAO",
        isActive: true
      });
    }

    console.log("\n--- Usuários preparados para os testes de controle ---");
    console.log(`Superadmin: ${adminUser.email} (${adminUser._id})`);
    console.log(`Assessor: ${assessorUser.email} (${assessorUser._id})`);
    console.log(`Citizen: ${citizenUser.email} (${citizenUser._id})`);

    // Teste 3: Exclusão permanente — Auto-exclusão impedida
    console.log("\n--> 3. Testando auto-exclusão impedida...");
    const req1: any = {
      params: { id: String(adminUser._id) },
      user: { id: String(adminUser._id), email: adminUser.email, role: adminUser.role }
    };
    const res1: any = {};
    try {
      await executeController(deleteUserPermanent, req1, res1);
      console.error("ERRO: Auto-exclusão deveria falhar mas passou!");
    } catch (err: any) {
      console.log(`Auto-exclusão falhou com: "${err.message}" (Esperado)`);
    }

    // Teste 4: Exclusão permanente — Superadmin por Assessor impedida
    console.log("\n--> 4. Testando exclusão de superadmin por assessor/admin comum impedida...");
    const req2: any = {
      params: { id: String(adminUser._id) },
      user: { id: String(assessorUser._id), email: assessorUser.email, role: assessorUser.role }
    };
    const res2: any = {};
    try {
      await executeController(deleteUserPermanent, req2, res2);
      console.error("ERRO: Deleção de superadmin por assessor deveria falhar!");
    } catch (err: any) {
      console.log(`Deleção de superadmin por assessor falhou com: "${err.message}" (Esperado)`);
    }

    // Teste 5: Redefinição de senha — Superadmin por Assessor impedida
    console.log("\n--> 5. Testando redefinição de senha de superadmin por assessor impedida...");
    const req3: any = {
      params: { id: String(adminUser._id) },
      user: { id: String(assessorUser._id), email: assessorUser.email, role: assessorUser.role },
      body: { password: "NewStrongPassword@2026" }
    };
    const res3: any = {};
    try {
      await executeController(resetUserPassword, req3, res3);
      console.error("ERRO: Redefinição de senha de superadmin por assessor deveria falhar!");
    } catch (err: any) {
      console.log(`Redefinição falhou com: "${err.message}" (Esperado)`);
    }

    // Teste 6: Redefinição de senha de Cidadão por Assessor com sucesso
    console.log("\n--> 6. Testando redefinição de senha com sucesso...");
    const req4: any = {
      params: { id: String(citizenUser._id) },
      user: { id: String(assessorUser._id), email: assessorUser.email, role: assessorUser.role },
      body: { password: "ValidResetPassword@2026", forcePasswordChange: true }
    };
    const res4: any = {};
    await executeController(resetUserPassword, req4, res4);
    
    const updatedCitizen = await User.findById(citizenUser._id);
    console.log(`Senha redefinida? ${res4.jsonData?.message === "Senha redefinida com sucesso." ? "Sim" : "Não"}`);
    console.log(`forcePasswordChange ativado? ${updatedCitizen?.get("forcePasswordChange") === true ? "Sim" : "Não"}`);

    // Teste 7: Exclusão permanente com sucesso de cidadão por Superadmin
    console.log("\n--> 7. Testando exclusão permanente bem-sucedida...");
    await User.deleteMany({ email: "temp_to_delete@luziane.com" });
    const tempUser = await User.create({
      name: "Temp Citizen to Delete",
      email: "temp_to_delete@luziane.com",
      passwordHash: "dummy",
      role: "CIDADAO",
      isActive: true
    });
    const req5: any = {
      params: { id: String(tempUser._id) },
      user: { id: String(adminUser._id), email: adminUser.email, role: adminUser.role }
    };
    const res5: any = {};
    await executeController(deleteUserPermanent, req5, res5);
    
    const deletedCheck = await User.findById(tempUser._id);
    console.log(`Mensagem de deleção: "${res5.jsonData?.message}"`);
    console.log(`Usuário ainda existe no banco? ${deletedCheck ? "Sim" : "Não (Excluído com sucesso)"}`);

  } finally {
    await mongoose.disconnect();
    console.log("\nConexão encerrada.");
  }
}

run().catch(console.error);
