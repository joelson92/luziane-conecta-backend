import { SystemSettings, User, BirthdayBannerView } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { renderNotificationTemplate } from "../utils/templateEngine.js";

function calculateAge(birthDate?: NativeDate): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getSaoPauloNow() {
  const todayStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const todayDate = new Date(todayStr);
  return {
    todayStr,
    currentDay: todayDate.getDate(),
    currentMonth: todayDate.getMonth() + 1 // 1 to 12
  };
}

function getBirthdayParts(birthDateStr: NativeDate | Date | string) {
  const bd = new Date(birthDateStr);
  return {
    birthDay: bd.getUTCDate(),
    birthMonth: bd.getUTCMonth() + 1 // 1 to 12
  };
}

export const getBirthdayBanner = asyncHandler(async (req: any, res) => {
  const user = await User.findById(req.user.id);
  
  console.log("[BIRTHDAY_BANNER] req.user", req.user);

  console.log("[BIRTHDAY_BANNER] user db", {
    id: user?._id,
    name: user?.name,
    birthDate: user?.birthDate,
    role: user?.role,
    isActive: user?.isActive
  });

  if (!user || user.role !== "CIDADAO" || !user.birthDate) {
    const resFalse = { show: false };
    console.log("[BIRTHDAY_BANNER] result", resFalse);
    return res.json(resFalse);
  }

  const { todayStr, currentDay, currentMonth } = getSaoPauloNow();
  const { birthDay, birthMonth } = getBirthdayParts(user.birthDate);

  console.log("[BIRTHDAY_BANNER] dates", {
    today: todayStr,
    currentDay,
    currentMonth,
    birthDay,
    birthMonth
  });
  
  if (birthMonth !== currentMonth) {
    const resFalse = { show: false };
    console.log("[BIRTHDAY_BANNER] result", resFalse);
    return res.json(resFalse);
  }

  const isToday = birthDay === currentDay && birthMonth === currentMonth;

  const userObj = {
    _id: user._id,
    name: user.name,
    birthDate: user.birthDate,
    neighborhood: user.neighborhood,
    neighborhoodName: user.neighborhoodName,
    community: user.community
  };

  const mode = isToday ? "TODAY" : "MONTH";
  const firstName = user.name.split(" ")[0] || "";
  
  let titleTemplate = "";
  let subtitleTemplate = "";
  let messageTemplate = "";
  let fullMessageTemplate = "";

  if (isToday) {
    titleTemplate = "🎂 Feliz aniversário, {{primeiroNome}}! 🎉";
    subtitleTemplate = "Hoje é um dia muito especial.";
    messageTemplate = "{{primeiroNome}}, que seu novo ciclo seja repleto de saúde, paz, felicidade e muitas conquistas. Receba o carinho da equipe Luziane Conecta.";
    fullMessageTemplate = "{{primeiroNome}}, hoje celebramos mais um capítulo da sua história. Que Deus continue iluminando seus caminhos, protegendo sua família e realizando seus sonhos. A equipe Luziane Conecta deseja um novo ciclo cheio de saúde, paz, prosperidade e felicidade. Parabéns pelo seu dia!";
  } else {
    titleTemplate = "🎉 Este mês é especial para você, {{primeiroNome}}!";
    subtitleTemplate = "A equipe Luziane Conecta celebra com você.";
    messageTemplate = "Que seu novo ciclo seja cheio de realizações, saúde e alegria.";
    fullMessageTemplate = "{{primeiroNome}}, este é o mês do seu aniversário. Receba nosso carinho e os melhores votos por este novo ciclo.";
  }

  const title = renderNotificationTemplate(userObj, titleTemplate);
  const subtitle = renderNotificationTemplate(userObj, subtitleTemplate);
  const message = renderNotificationTemplate(userObj, messageTemplate);
  const fullMessage = renderNotificationTemplate(userObj, fullMessageTemplate);

  const result = {
    show: true,
    mode,
    firstName,
    name: user.name,
    age: calculateAge(user.birthDate),
    title,
    subtitle,
    message,
    fullMessage
  };

  console.log("[BIRTHDAY_BANNER] result", result);

  res.json(result);
});

export const trackBirthdayBannerView = asyncHandler(async (req: any, res) => {
  const now = new Date();
  await BirthdayBannerView.findOneAndUpdate(
    { userId: req.user.id, year: now.getFullYear(), month: now.getMonth() + 1 },
    { 
      $inc: { views: 1 },
      $setOnInsert: { firstViewedAt: now },
      $set: { lastViewedAt: now }
    },
    { upsert: true }
  );

  res.json({ success: true });
});
