import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, UserConsent } from "../src/models/index.js";
import { env } from "../src/config/env.js";

async function run() {
  console.log("=== INICIANDO TESTES DO FLUXO DE CADASTRO ===");
  
  // 1. Conectar ao banco de dados
  await mongoose.connect(env.MONGODB_URI);
  console.log("Conectado ao MongoDB com sucesso.");

  const testEmail = "cidadao_teste@luzianeconecta.com";

  try {
    // 2. Limpar usuário de teste anterior
    await User.deleteOne({ email: testEmail });
    await UserConsent.deleteMany({ userId: { $exists: true } }); // Limpa consentimentos órfãos
    console.log("Limpeza pré-teste concluída.");

    // 3. Simular payload com tentativa de injeção de role (SUPER_ADMIN)
    const payload = {
      name: "Cidadão de Teste Completo",
      email: testEmail,
      phone: "999999999",
      password: "senhaSegura123",
      city: "Luziane",
      neighborhood: "Centro",
      community: "Comunidade da Ponte",
      birthDate: "1990-05-15",
      gender: "Masculino",
      interests: ["saúde", "segurança", "esporte"],
      acceptedTerms: true,
      role: "SUPER_ADMIN", // TENTATIVA DE INJEÇÃO
      isActive: false     // TENTATIVA DE INJEÇÃO
    };

    console.log("Enviando requisição POST para registro...");
    
    // Fazer chamada local via fetch ou instanciar direto o fluxo. 
    // Como a API está rodando na porta 4000, podemos fazer uma chamada fetch normal!
    const response = await fetch("http://localhost:4000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json() as any;

    if (response.status !== 201) {
      throw new Error(`Falha no registro: Status ${response.status}. Detalhes: ${JSON.stringify(responseData)}`);
    }

    console.log("Registro efetuado via API com sucesso (Status 201).");
    
    // 4. Buscar o usuário recém-criado no banco para validar a segurança das propriedades
    const userInDb = await User.findOne({ email: testEmail });
    if (!userInDb) {
      throw new Error("Erro: O usuário não foi encontrado no banco de dados.");
    }

    console.log("\n--- Validações de Segurança no Banco de Dados ---");
    
    // Validar role forçada para CIDADAO
    console.log(`Role no banco: ${userInDb.role} (Esperado: CIDADAO)`);
    if (userInDb.role !== "CIDADAO") {
      throw new Error("ALERTA DE SEGURANÇA: O usuário foi criado com privilégios injetados!");
    }
    console.log("✓ Sucesso: Tentativa de injeção de role SUPER_ADMIN bloqueada.");

    // Validar isActive forçado para true
    console.log(`Status isActive: ${userInDb.isActive} (Esperado: true)`);
    if (!userInDb.isActive) {
      throw new Error("Erro: O usuário deveria ser ativo por padrão.");
    }
    console.log("✓ Sucesso: Tentativa de injeção de isActive bloqueada.");

    // Validar Hash de Senha
    console.log(`Senha em formato hash: ${userInDb.passwordHash}`);
    if (userInDb.passwordHash === "senhaSegura123") {
      throw new Error("ALERTA DE SEGURANÇA: Senha gravada em texto puro!");
    }
    const isPasswordCorrect = await bcrypt.compare("senhaSegura123", userInDb.passwordHash);
    if (!isPasswordCorrect) {
      throw new Error("Erro: O hash da senha não bate com a senha original.");
    }
    console.log("✓ Sucesso: Senha criptografada corretamente.");

    // Validar campos adicionais
    console.log(`Gênero: ${userInDb.gender} (Esperado: Masculino)`);
    if (userInDb.gender !== "Masculino") {
      throw new Error("Erro: Gênero não foi persistido.");
    }
    console.log(`Interesses: ${userInDb.interests?.join(", ")} (Esperado: saúde, segurança, esporte)`);
    if (!userInDb.interests || userInDb.interests.length !== 3) {
      throw new Error("Erro: Interesses não foram persistidos.");
    }
    console.log("✓ Sucesso: Gênero e Interesses persistidos perfeitamente.");

    // 5. Validar criação automática de consentimento (UserConsent) no banco
    const consentInDb = await UserConsent.findOne({ userId: userInDb.id });
    if (!consentInDb) {
      throw new Error("Erro: Registro de consentimento legal (UserConsent) não foi gerado automaticamente.");
    }
    console.log("✓ Sucesso: Registro de termos de consentimento criado automaticamente.");

    // 6. Testar tentativa de e-mail duplicado
    console.log("\n--- Validação de E-mail Duplicado ---");
    const duplicateResponse = await fetch("http://localhost:4000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log(`Resposta duplicada: Status ${duplicateResponse.status}`);
    if (duplicateResponse.status !== 409) {
      throw new Error(`Erro: Esperava código 409 para email duplicado, mas retornou ${duplicateResponse.status}`);
    }
    const duplicateData = await duplicateResponse.json() as any;
    console.log(`Mensagem de erro: ${duplicateData.message}`);
    console.log("✓ Sucesso: Validação de e-mail duplicado bloqueou o cadastro secundário.");

    console.log("\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
  } catch (err: any) {
    console.error("\n❌ ERRO NOS TESTES:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("Conexão com MongoDB encerrada.");
  }
}

run();
