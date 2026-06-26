import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { User } from "../models/index.js";

function getSaoPauloNow() {
  const todayStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const todayDate = new Date(todayStr);
  return {
    todayStr,
    currentDay: todayDate.getDate(),
    currentMonth: todayDate.getMonth() + 1 // 1 to 12
  };
}

function getBirthdayParts(birthDateStr: any) {
  const bd = new Date(birthDateStr);
  return {
    birthDay: bd.getUTCDate(),
    birthMonth: bd.getUTCMonth() + 1 // 1 to 12
  };
}

async function main() {
  try {
    await connectDatabase();
    
    // Buscar o usuário João
    const user = await User.findOne({ name: /Joao/i, role: "CIDADAO" });
    if (!user) {
      console.log("Usuário João não encontrado!");
      return;
    }

    console.log("==== TESTE BIRTHDAY BANNER ====");
    console.log("name:", user.name);
    console.log("birthDate (db):", user.birthDate);
    
    if (!user.birthDate) {
      console.log("expectedShow: false (sem birthDate)");
      return;
    }

    const { todayStr, currentDay, currentMonth } = getSaoPauloNow();
    const { birthDay, birthMonth } = getBirthdayParts(user.birthDate);

    console.log("currentDay:", currentDay);
    console.log("currentMonth:", currentMonth);
    console.log("birthDay:", birthDay);
    console.log("birthMonth:", birthMonth);
    console.log("todayStr (America/Sao_Paulo):", todayStr);

    let expectedShow = false;
    let expectedMode = "";

    if (birthMonth === currentMonth) {
      expectedShow = true;
      if (birthDay === currentDay) {
        expectedMode = "TODAY";
      } else {
        expectedMode = "MONTH";
      }
    }

    console.log("expectedShow:", expectedShow);
    console.log("expectedMode:", expectedMode);

  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
