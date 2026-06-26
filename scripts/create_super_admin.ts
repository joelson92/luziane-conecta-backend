import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "../src/models/User.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta");
    const email = "admin@luzianeconecta.com".toLowerCase();
    let user = await User.findOne({ email });
    
    const passwordHash = await bcrypt.hash("12345678", 12);
    let created = false;

    if (user) {
      user.passwordHash = passwordHash;
      user.role = "SUPER_ADMIN";
      user.isActive = true;
      await user.save();
    } else {
      user = await User.create({
        name: "Super Admin",
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
        acceptedTerms: true,
        acceptedPrivacy: true,
        appInstalledAt: new Date(),
        lastLoginAt: new Date()
      });
      created = true;
    }

    console.log("FINAL_LOG:", JSON.stringify({
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      created
    }, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
