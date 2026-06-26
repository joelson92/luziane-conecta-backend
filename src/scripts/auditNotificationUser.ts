import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { User } from "../models/index.js";
import { resolveNotificationTargets, normalizeFilters } from "../services/notificationTargetService.js";
import { normalizeNeighborhoodName } from "../utils/neighborhood.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  const queryParam = process.argv[2];
  if (!queryParam) {
    console.log("Uso: npx tsx src/scripts/auditNotificationUser.ts <email ou nome>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/luziane-conecta");
  console.log("✅ MongoDB conectado.\n");

  const user = await User.findOne({
    $or: [
      { email: queryParam },
      { name: new RegExp(queryParam, "i") }
    ]
  }).lean();

  if (!user) {
    console.log(`❌ Usuário "${queryParam}" não encontrado.`);
    process.exit(1);
  }

  console.log("=== DADOS DO USUÁRIO ===");
  console.log("_id:", user._id);
  console.log("name:", user.name);
  console.log("email:", (user as any).email);
  console.log("role:", user.role);
  console.log("isActive:", (user as any).isActive ?? true);
  console.log("neighborhood:", (user as any).neighborhood);
  console.log("neighborhoodName:", (user as any).neighborhoodName);
  console.log("community:", (user as any).community);
  console.log("city:", (user as any).address?.city);
  console.log("state:", (user as any).address?.state);
  console.log("locationConfirmed:", (user as any).locationConfirmed);
  console.log("latitude:", (user as any).location?.latitude);
  console.log("longitude:", (user as any).location?.longitude);
  console.log("expoPushToken:", user.expoPushToken);
  console.log("pushToken:", (user as any).pushToken);
  console.log("pushTokens:", (user as any).pushTokens);
  console.log("createdAt:", (user as any).createdAt);
  console.log("\n");

  const rawUserNeigh = (user as any).neighborhoodName || (user as any).neighborhood || (user as any).address?.neighborhood || (user as any).location?.neighborhood;
  const userNeigh = normalizeNeighborhoodName(rawUserNeigh);

  console.log("=== SIMULAÇÃO DE SEGMENTAÇÃO POR BAIRRO ===");
  const targetType = "NEIGHBORHOOD";
  const filters = { neighborhoods: [rawUserNeigh] };

  console.log("targetType:", targetType);
  console.log("filters:", filters);
  console.log("bairro selecionado normalizado:", normalizeFilters(filters).neighborhoods);
  console.log("bairro do usuário normalizado:", userNeigh);

  const preview = await resolveNotificationTargets(targetType, filters);
  const foundUser = preview.users.find(u => String(u._id) === String(user._id));

  console.log("\nMotivo de inclusão ou exclusão:");
  if (foundUser) {
    console.log(`✅ INCLUÍDO. O usuário apareceu na lista de ${preview.totalRecipients} destinatários estimados.`);
    if (!user.expoPushToken && !(user as any).pushToken && !(user as any).pushTokens?.length) {
      console.log("⚠️ AVISO: O usuário está na lista, mas não possui token. Na hora do envio, ele será ignorado pelo Push e constará como FAILED no histórico.");
    }
  } else {
    console.log(`❌ EXCLUÍDO.`);
    if ((user as any).isActive === false) {
      console.log("- Usuário está inativo (isActive = false).");
    } else if (!normalizeFilters(filters).neighborhoods.includes(userNeigh)) {
      console.log("- O bairro normalizado do usuário não bate com o bairro selecionado.");
    } else {
      console.log("- Excluído por outro motivo não documentado pela query principal.");
    }
  }

  process.exit(0);
}

run().catch(console.error);
