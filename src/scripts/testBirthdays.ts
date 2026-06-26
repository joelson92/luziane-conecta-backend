import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User, Notification, NotificationDelivery } from "../models/index.js";

async function run() {
  console.log("=== INICIANDO TESTE DE AUDITORIA DE ANIVERSARIANTES ===");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Conectado ao MongoDB.");

  // Preparar os usuários mock
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const bdayThisMonth = `1990-${String(currentMonth).padStart(2, '0')}-15T00:00:00Z`;
  const bdayNextMonth = `1990-${String(nextMonth).padStart(2, '0')}-15T00:00:00Z`;

  const userThisMonth = await User.findOneAndUpdate(
    { email: "bday_this@luziane.com" },
    {
      name: "Aniversariante Este Mês",
      role: "CIDADAO",
      birthDate: new Date(bdayThisMonth),
      neighborhood: "Centro",
      isActive: true,
      pushTokens: ["ExponentPushToken[BDAY_THIS]"],
      expoPushToken: "ExponentPushToken[BDAY_THIS]",
      location: { type: "Point", coordinates: [-47.88, -15.79] }
    },
    { upsert: true, new: true }
  );

  const userNextMonth = await User.findOneAndUpdate(
    { email: "bday_next@luziane.com" },
    {
      name: "Aniversariante Outro Mês",
      role: "CIDADAO",
      birthDate: new Date(bdayNextMonth),
      neighborhood: "Centro",
      isActive: true,
      pushTokens: ["ExponentPushToken[BDAY_NEXT]"],
      expoPushToken: "ExponentPushToken[BDAY_NEXT]",
      location: { type: "Point", coordinates: [-47.88, -15.79] }
    },
    { upsert: true, new: true }
  );

  const userNoToken = await User.findOneAndUpdate(
    { email: "bday_notoken@luziane.com" },
    {
      name: "Aniversariante Sem Token",
      role: "CIDADAO",
      birthDate: new Date(bdayThisMonth),
      neighborhood: "Vila Rica",
      isActive: true,
      location: { type: "Point", coordinates: [-47.88, -15.79] },
      $unset: { expoPushToken: 1, pushTokens: 1 }
    },
    { upsert: true, new: true }
  );

  console.log("Usuários criados/atualizados com sucesso.");

  console.log(`\n-> Validando busca de aniversariantes do mês atual (${currentMonth})`);

  const query: any = { role: "CIDADAO", isActive: true };
  query.$expr = { $eq: [{ $month: "$birthDate" }, currentMonth] };

  const usersThisMonth = await User.find(query).lean();
  
  const hasUserThisMonth = usersThisMonth.some(u => String(u._id) === String(userThisMonth._id));
  const hasUserNoToken = usersThisMonth.some(u => String(u._id) === String(userNoToken._id));
  const hasUserNextMonth = usersThisMonth.some(u => String(u._id) === String(userNextMonth._id));

  if (hasUserThisMonth && hasUserNoToken && !hasUserNextMonth) {
    console.log("🟢 OK: Busca filtrou perfeitamente pelo mês atual!");
  } else {
    console.error("🔴 FALHA: A busca de mês falhou.", { hasUserThisMonth, hasUserNoToken, hasUserNextMonth });
  }

  console.log(`\n-> Validando filtro por bairro (Vila Rica)`);
  query.neighborhoodName = { $regex: new RegExp("^vila rica$", "i") };
  const usersVilaRica = await User.find(query).lean();
  if (usersVilaRica.length === 1 && String(usersVilaRica[0]._id) === String(userNoToken._id)) {
    console.log("🟢 OK: Filtro de bairro cruzado com mês funcionou perfeitamente!");
  } else {
    console.error("🔴 FALHA: Filtro de bairro não isolou o usuário corretamente.", usersVilaRica);
  }

  console.log("\nLimpeza pós-teste...");
  await User.deleteMany({ email: { $in: ["bday_this@luziane.com", "bday_next@luziane.com", "bday_notoken@luziane.com"] } });
  
  await mongoose.disconnect();
  console.log("Conexão com o banco de dados encerrada.");
}

run().catch(console.error);
