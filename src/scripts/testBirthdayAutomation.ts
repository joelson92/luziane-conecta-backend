import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { sendTodayBirthdayCongratulations } from "../services/birthdayAutomationService.js";

async function main() {
  try {
    await connectDatabase();
    console.log("Conectado ao banco de dados.");
    
    console.log("Rodando automação de aniversários manualmente...");
    const result = await sendTodayBirthdayCongratulations();
    console.log("Resultado da execução:", result);
    
  } catch (err) {
    console.error("Erro fatal na automação:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Banco de dados desconectado.");
    process.exit(0);
  }
}

main();
