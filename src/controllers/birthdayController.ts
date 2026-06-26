import { User, Notification, NotificationDelivery } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { sendPushToTokens } from "../services/notificationService.js";
import { getUserTokens } from "../services/notificationTargetService.js";
import { renderNotificationTemplate } from "../utils/templateEngine.js";
import { buildNeighborhoodQuery } from "../services/neighborhoodService.js";
import { sendTodayBirthdayCongratulations } from "../services/birthdayAutomationService.js";
import mongoose from "mongoose";

export const listBirthdays = asyncHandler(async (req, res) => {
  const month = parseInt(String(req.query.month), 10);
  if (isNaN(month) || month < 1 || month > 12) {
    throw new AppError(400, "Mês inválido (1-12).");
  }

  const query: any = { role: "CIDADAO", isActive: true };
  
  Object.assign(query, await buildNeighborhoodQuery({ 
    neighborhoodId: req.query.neighborhoodId, 
    neighborhood: req.query.neighborhood 
  }));

  if (req.query.community) {
    query.community = req.query.community;
  }

  if (req.query.search) {
    const search = new RegExp(String(req.query.search), "i");
    query.name = search;
  }

  // Filtrar usuários onde o mês de birthDate seja igual a month
  query.$expr = { $eq: [{ $month: "$birthDate" }, month] };

  const users = await User.find(query).select("name birthDate neighborhood neighborhoodName community phone expoPushToken pushTokens").lean();

  // Calcular a idade para o frontend
  const now = new Date();
  const data = users.map((u: any) => {
    let age = undefined;
    if (u.birthDate) {
      const birth = new Date(u.birthDate);
      age = now.getFullYear() - birth.getFullYear();
      if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
        age--;
      }
    }
    return {
      id: u._id,
      name: u.name,
      birthDate: u.birthDate,
      age,
      neighborhood: u.neighborhood,
      neighborhoodName: u.neighborhoodName,
      community: u.community,
      phone: u.phone,
      expoPushToken: u.expoPushToken
    };
  });

  res.json({ data });
});

export const congratulate = asyncHandler(async (req: any, res) => {
  try {
    console.log("[BIRTHDAY_CONGRATULATE_PAYLOAD]", req.body);

    const rawUserIds = req.body.userIds || req.body.selectedUserIds || [];
    const title = req.body.title || "Feliz Aniversário!";
    const message = req.body.message || req.body.body || "";

    if (!Array.isArray(rawUserIds) || rawUserIds.length === 0) {
      throw new AppError(400, "Selecione pelo menos um aniversariante.");
    }
    if (!message) {
      throw new AppError(400, "A mensagem é obrigatória.");
    }

    const currentUserId = req.user.id;

    // Validate ObjectIds
    const validUserIds = rawUserIds.filter(id => mongoose.isValidObjectId(id));
    if (validUserIds.length === 0) {
      throw new AppError(400, "Nenhum ID de usuário válido fornecido.");
    }

    // Encontrar os usuários
    const users = await User.find({
      _id: { $in: validUserIds },
      isActive: true,
      birthDate: { $exists: true, $ne: null }
    });
    
    if (users.length === 0) {
      throw new AppError(400, "Nenhum usuário ativo com data de nascimento foi encontrado.");
    }

    console.log(`[BIRTHDAY_CONGRATULATE] Selecionados ${users.length} aniversariantes válidos.`);

    // Criar histórico no banco de dados primeiro
    const targetType = "SPECIFIC_USERS";
    const recipientIds = users.map(u => u._id);

    const notification = await Notification.create({
      type: "BIRTHDAY",
      targetType,
      title, 
      message, 
      body: message, 
      targetFilters: { userIds: recipientIds },
      recipientIds,
      recipientCount: users.length,
      successCount: 0,
      failureCount: 0,
      status: "DRAFT",
      sentAt: new Date(),
      sentBy: currentUserId,
      provider: "EXPO"
    });

    // Enviar push individualizado
    let successCount = 0;
    let failureCount = 0;

    for (const recipient of users) {
      const userTokens = getUserTokens(recipient as any);
      
      const recipientObj = {
        _id: recipient._id,
        name: recipient.name,
        birthDate: recipient.birthDate,
        neighborhood: recipient.neighborhood,
        neighborhoodName: recipient.neighborhoodName,
        community: recipient.community
      };

      const personalizedTitle = renderNotificationTemplate(recipientObj, title);
      const personalizedBody = renderNotificationTemplate(recipientObj, message);

      let isSuccess = false;
      let lastErrorStr = "";

      if (userTokens.length === 0) {
        lastErrorStr = "Usuário sem Expo Push Token válido";
        failureCount++;
      } else {
        try {
          const results = await sendPushToTokens(userTokens, personalizedTitle, personalizedBody, {
            type: "BIRTHDAY_CONGRATULATION",
            userIds: [recipient.id],
            notificationId: notification._id
          });
          
          if (results.sent > 0) {
            isSuccess = true;
            successCount += 1;
          } else {
            lastErrorStr = "Falha ao enviar via Expo (PushResult.failed > 0)";
            failureCount++;
          }
        } catch (e: any) {
          lastErrorStr = e.message || "Erro desconhecido ao enviar";
          failureCount++;
        }
      }

      await NotificationDelivery.create({
        notificationId: notification._id,
        userId: recipient._id,
        status: isSuccess ? "SENT" : "FAILED",
        error: lastErrorStr || undefined,
        sentAt: isSuccess ? new Date() : undefined
      });
    }

    const status = successCount > 0 ? "SENT" : "FAILED";

    await Notification.findByIdAndUpdate(notification._id, {
      successCount,
      failureCount,
      status,
      completedAt: new Date()
    });

    res.json({ success: true, successCount, failureCount });
  } catch (error: any) {
    console.error("===== BIRTHDAY_CONGRATULATE_ERROR =====");
    console.error(error);
    console.error(error?.stack);
    console.error("[BIRTHDAY_CONGRATULATE_BODY]", req.body);
    console.error("[BIRTHDAY_CONGRATULATE_USER]", req.user);
    
    if (error instanceof AppError) {
      throw error;
    }
    return res.status(400).json({ error: "Erro ao processar envio", message: error.message });
  }
});

export const runAutomation = asyncHandler(async (req, res) => {
  const result = await sendTodayBirthdayCongratulations();
  res.json(result);
});
