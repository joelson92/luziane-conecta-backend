import { SystemSettings } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";

async function getSettingsDocument() {
  return SystemSettings.findOneAndUpdate(
    {}, 
    { 
      $setOnInsert: { 
        appDownloads: 0,
        whatsappChannelUrl: "",
        instagramUrl: "",
        youtubeUrl: "",
        facebookUrl: ""
      } 
    }, 
    { upsert: true, new: true }
  );
}

export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettingsDocument();
  res.json({ data: settings });
});

export const getPublicSettings = asyncHandler(async (_req, res) => {
  const settings = await getSettingsDocument();
  res.json({
    data: {
      whatsappChannelUrl: settings.whatsappChannelUrl || "",
      instagramUrl: settings.instagramUrl || "",
      youtubeUrl: settings.youtubeUrl || "",
      facebookUrl: settings.facebookUrl || ""
    }
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const appDownloads = Number(req.body.appDownloads ?? 0);
  const whatsappChannelUrl = req.body.whatsappChannelUrl ? String(req.body.whatsappChannelUrl).trim() : "";
  const instagramUrl = req.body.instagramUrl ? String(req.body.instagramUrl).trim() : "";
  const youtubeUrl = req.body.youtubeUrl ? String(req.body.youtubeUrl).trim() : "";
  const facebookUrl = req.body.facebookUrl ? String(req.body.facebookUrl).trim() : "";

  // Validate WhatsApp URL
  if (whatsappChannelUrl && !whatsappChannelUrl.match(/^https?:\/\/(www\.)?(chat\.)?whatsapp\.com\/.+/i)) {
    throw new AppError(400, "URL do Canal do WhatsApp inválida. Deve iniciar com http/https e pertencer ao whatsapp.com");
  }

  const settings = await SystemSettings.findOneAndUpdate(
    {},
    {
      $set: {
        appDownloads,
        whatsappChannelUrl,
        instagramUrl,
        youtubeUrl,
        facebookUrl
      }
    },
    { upsert: true, new: true }
  );
  res.json({ data: settings });
});

