import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { User } from "../models/index.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

async function main() {
  try {
    await connectDatabase();
    const user = await User.findOne({ name: /Joao/i, role: "CIDADAO" });
    if (!user) {
      console.log("Usuário João não encontrado!");
      return;
    }

    const token = jwt.sign({ id: user._id, role: user.role }, env.JWT_SECRET, {
      expiresIn: "1h"
    });

    const res = await fetch("http://localhost:4000/api/me/birthday-banner", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text);

  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
