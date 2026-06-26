import { connectDatabase } from "../config/db.js";
import { User } from "../models/index.js";
import mongoose from "mongoose";

async function run() {
  await connectDatabase();

  const superAdmins = await User.find({ role: "SUPER_ADMIN" }).lean();
  console.log(`Encontrados ${superAdmins.length} usuários SUPER_ADMIN.`);

  for (const admin of superAdmins) {
    console.log(JSON.stringify({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      hasPasswordHash: Boolean(admin.passwordHash)
    }, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
