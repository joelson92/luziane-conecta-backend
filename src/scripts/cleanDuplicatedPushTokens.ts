import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { User } from "../models/User.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  console.log("=== INICIANDO LIMPEZA DE TOKENS PUSH DUPLICADOS ===");
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    // Buscar todos os usuários que possuem expoPushToken válido
    const usersWithToken = await User.find({ expoPushToken: { $exists: true, $ne: "" } })
      .select("_id name email expoPushToken lastLoginAt updatedAt")
      .lean();

    console.log(`Total de usuários com expoPushToken: ${usersWithToken.length}`);

    // Agrupar usuários pelo token
    const tokenGroups: Record<string, typeof usersWithToken> = {};
    for (const user of usersWithToken) {
      if (!user.expoPushToken) continue;
      if (!tokenGroups[user.expoPushToken]) {
        tokenGroups[user.expoPushToken] = [];
      }
      tokenGroups[user.expoPushToken].push(user);
    }

    let duplicatedTokensCount = 0;
    let removedFromCount = 0;

    for (const [token, users] of Object.entries(tokenGroups)) {
      if (users.length > 1) {
        duplicatedTokensCount++;
        console.log(`\nToken repetido encontrado: ${token}`);
        console.log(`Presente em ${users.length} usuários.`);

        // Ordenar usuários por lastLoginAt (ou updatedAt) descrescente (mais recente primeiro)
        users.sort((a, b) => {
          const dateA = (a.lastLoginAt || a.updatedAt || new Date(0)).getTime();
          const dateB = (b.lastLoginAt || b.updatedAt || new Date(0)).getTime();
          return dateB - dateA; // Maior (mais recente) primeiro
        });

        const winner = users[0];
        const losers = users.slice(1);

        console.log(`-> Mantendo token no usuário: ${winner.name} (${winner.email})`);
        
        const loserIds = losers.map(l => l._id);
        
        const updateResult = await User.updateMany(
          { _id: { $in: loserIds } },
          {
            $unset: { expoPushToken: "", pushToken: "" },
            $pull: { pushTokens: token }
          }
        );

        console.log(`-> Removido de ${updateResult.modifiedCount} usuários inativos no dispositivo.`);
        removedFromCount += updateResult.modifiedCount;
      }
    }

    console.log("\n=== RELATÓRIO FINAL ===");
    console.log(`Tokens duplicados encontrados: ${duplicatedTokensCount}`);
    console.log(`Associações indevidas removidas: ${removedFromCount}`);
    console.log("Limpeza concluída com sucesso!");

  } catch (error) {
    console.error("Erro durante a execução do script:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Conexão com o banco de dados encerrada.");
  }
}

run();
