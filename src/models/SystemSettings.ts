import mongoose, { Schema } from "mongoose";

const systemSettingsSchema = new Schema(
  {
    appDownloads: { type: Number, default: 0 },
    whatsappChannelUrl: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    youtubeUrl: { type: String, default: "" },
    facebookUrl: { type: String, default: "" },
    birthdayCardTitle: { type: String, default: "🎉 Feliz aniversário, {{primeiroNome}}!" },
    birthdayCardMessageShort: { type: String, default: "Hoje é um mês especial para você. Receba o carinho da equipe Luziane Conecta." },
    birthdayCardMessageFull: { type: String, default: "{{primeiroNome}}, que este novo ciclo seja repleto de saúde, paz, felicidade e muitas conquistas. Receba nosso carinho e os melhores votos da equipe Luziane Conecta." },
    birthdayCardFooter: { type: String, default: "Com carinho, Equipe Luziane Conecta." }
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);

