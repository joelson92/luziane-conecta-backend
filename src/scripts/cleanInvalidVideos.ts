import mongoose from "mongoose";
import { Video } from "../models/Video.js";
import { extractYoutubeVideoId } from "../utils/youtube.js";

async function run() {
  console.log("=== INICIANDO SCRIPT DE LIMPEZA DE VÍDEOS INSTITUCIONAIS ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    const videos = await Video.find({ sourceType: { $ne: "upload" } });
    console.log(`Encontrados ${videos.length} vídeos externos para análise.`);

    let removedCount = 0;
    let correctedCount = 0;

    for (const video of videos) {
      const url = video.videoUrl || "";
      const extractedId = extractYoutubeVideoId(url);

      if (!extractedId) {
        // Vídeo com URL inválida -> remover
        console.log(`[REMOVIDO] Vídeo inválido removido: ID=${video._id} | Título="${video.title}" | videoUrl="${url}"`);
        await Video.deleteOne({ _id: video._id });
        removedCount++;
      } else {
        // Vídeo com URL válida -> garantir que videoId e provider estão preenchidos
        if (!video.videoId || video.provider !== "YOUTUBE" || video.platform !== "youtube") {
          video.videoId = extractedId;
          video.provider = "YOUTUBE";
          video.platform = "youtube";
          await video.save();
          console.log(`[CORRIGIDO] Vídeo atualizado com metadados: ID=${video._id} | Título="${video.title}" | videoId="${extractedId}"`);
          correctedCount++;
        }
      }
    }

    console.log("\n=== LIMPEZA E ATUALIZAÇÃO CONCLUÍDAS ===");
    console.log(`Vídeos removidos (links inválidos): ${removedCount}`);
    console.log(`Vídeos corrigidos/atualizados: ${correctedCount}`);

  } finally {
    await mongoose.disconnect();
    console.log("Conexão encerrada.");
  }
}

run().catch(console.error);
