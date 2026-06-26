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
        facebookUrl: "",
        birthdayCardTitle: "🎉 Feliz aniversário, {{primeiroNome}}!",
        birthdayCardMessageShort: "Hoje é um mês especial para você. Receba o carinho da equipe Luziane Conecta.",
        birthdayCardMessageFull: "{{primeiroNome}}, que este novo ciclo seja repleto de saúde, paz, felicidade e muitas conquistas. Receba nosso carinho e os melhores votos da equipe Luziane Conecta.",
        birthdayCardFooter: "Com carinho, Equipe Luziane Conecta."
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
  const birthdayCardTitle = req.body.birthdayCardTitle ? String(req.body.birthdayCardTitle).trim() : "🎉 Feliz aniversário, {{primeiroNome}}!";
  const birthdayCardMessageShort = req.body.birthdayCardMessageShort ? String(req.body.birthdayCardMessageShort).trim() : "Hoje é um mês especial para você. Receba o carinho da equipe Luziane Conecta.";
  const birthdayCardMessageFull = req.body.birthdayCardMessageFull ? String(req.body.birthdayCardMessageFull).trim() : "{{primeiroNome}}, que este novo ciclo seja repleto de saúde, paz, felicidade e muitas conquistas. Receba nosso carinho e os melhores votos da equipe Luziane Conecta.";
  const birthdayCardFooter = req.body.birthdayCardFooter ? String(req.body.birthdayCardFooter).trim() : "Com carinho, Equipe Luziane Conecta.";

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
        facebookUrl,
        birthdayCardTitle,
        birthdayCardMessageShort,
        birthdayCardMessageFull,
        birthdayCardFooter
      }
    },
    { upsert: true, new: true }
  );
  res.json({ data: settings });
});

