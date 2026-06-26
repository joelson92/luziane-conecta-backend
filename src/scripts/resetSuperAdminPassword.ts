import { connectDatabase } from "../config/db.js";
import { User } from "../models/index.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

async function run() {
  await connectDatabase();

  const email = process.argv[2];
  const novaSenha = process.argv[3];

  if (!email || !novaSenha) {
    console.log("Uso: npx tsx resetSuperAdminPassword.ts <email> <nova_senha>");
    await mongoose.disconnect();
    process.exit(1);
  }

  const emailLower = email.toLowerCase().trim();
  const user = await User.findOne({ email: emailLower });
  if (!user) {
    console.log("Usuário não encontrado.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(novaSenha, 12);
  
  await User.updateOne({ _id: user._id }, {
    $set: { passwordHash, isActive: true }
  });

  console.log(`Senha do usuário ${user.email} redefinida com sucesso. role atual: ${user.role}`);
  
  await mongoose.disconnect();
}

run().catch(console.error);
