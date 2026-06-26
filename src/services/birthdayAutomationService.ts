import { User, Notification, NotificationDelivery } from "../models/index.js";
import { getUserTokens } from "./notificationTargetService.js";
import { sendPushToTokens } from "./notificationService.js";
import { renderNotificationTemplate } from "../utils/templateEngine.js";

export async function sendTodayBirthdayCongratulations() {
  console.log("[BIRTHDAY_AUTO] start");
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const todayStr = `${now.getFullYear()}-${String(currentMonth + 1).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;
  
  console.log("[BIRTHDAY_AUTO] today", todayStr);

  const users = await User.find({
    isActive: true,
    birthDate: { $exists: true, $ne: null }
  });

  const birthdayUsers = users.filter(u => {
    if (!u.birthDate) return false;
    const bd = new Date(u.birthDate);
    return bd.getUTCMonth() === currentMonth && bd.getUTCDate() === currentDay;
  });

  console.log("[BIRTHDAY_AUTO] users found", birthdayUsers.length);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of birthdayUsers) {
    console.log("[BIRTHDAY_AUTO] processing user", user._id);
    
    // Check duplication
    const existing = await Notification.findOne({
      type: "BIRTHDAY_AUTO",
      birthdayAutoDate: todayStr,
      recipientIds: user._id
    });

    if (existing) {
      console.log("[BIRTHDAY_AUTO] already sent skip", user._id);
      skipped++;
      continue;
    }

    const titleTemplate = "🎂 Feliz aniversário, {{primeiroNome}}! 🎉";
    const messageTemplate = "{{primeiroNome}}, hoje é um dia muito especial. Toda a equipe Luziane Conecta deseja que seu novo ciclo seja repleto de saúde, paz, felicidade e muitas conquistas. Receba nosso carinho!";
    
    const userObj = {
      _id: user._id,
      name: user.name,
      birthDate: user.birthDate,
      neighborhood: user.neighborhood,
      neighborhoodName: user.neighborhoodName,
      community: user.community
    };

    const title = renderNotificationTemplate(userObj, titleTemplate);
    const message = renderNotificationTemplate(userObj, messageTemplate);

    const tokens = getUserTokens(user as any);
    console.log("[BIRTHDAY_AUTO] token count", tokens.length);

    // Create Notification first
    const notification = new Notification({
      title,
      message,
      body: message,
      targetType: "SPECIFIC_USERS",
      targetFilters: { userIds: [user._id] },
      recipientCount: 1,
      type: "BIRTHDAY_AUTO",
      birthdayAutoDate: todayStr,
      recipientIds: [user._id],
      status: "DRAFT"
    });
    
    await notification.save();

    let isSuccess = false;
    let lastErrorStr = "";

    if (tokens.length === 0) {
      console.log("[BIRTHDAY_AUTO] failed: Usuário sem Expo Push Token válido");
      lastErrorStr = "Usuário sem Expo Push Token válido";
      failed++;
    } else {
      try {
        const results = await sendPushToTokens(tokens, title, message, {
          route: "HOME"
        });
        
        const hasSuccess = results.sent > 0;
        if (hasSuccess) {
          isSuccess = true;
          sent++;
          console.log("[BIRTHDAY_AUTO] sent", user._id);
        } else {
          lastErrorStr = "Falha ao enviar via Expo (PushResult.failed > 0)";
          console.log("[BIRTHDAY_AUTO] failed", lastErrorStr);
          failed++;
        }
      } catch (err: any) {
        lastErrorStr = err.message || "Erro ao enviar via Expo";
        console.log("[BIRTHDAY_AUTO] failed", lastErrorStr);
        failed++;
      }
    }

    notification.status = isSuccess ? "SENT" : "FAILED";
    notification.successCount = isSuccess ? 1 : 0;
    notification.failureCount = isSuccess ? 0 : 1;
    notification.sentCount = isSuccess ? 1 : 0;
    notification.sentAt = new Date();
    notification.lastError = lastErrorStr;
    await notification.save();

    const delivery = new NotificationDelivery({
      notificationId: notification._id,
      userId: user._id,
      status: isSuccess ? "SENT" : "FAILED"
    });
    await delivery.save();

    processed++;
  }

  console.log("[BIRTHDAY_AUTO] finished", { processed, sent, failed, skipped });

  return { processed, sent, failed, skipped };
}
