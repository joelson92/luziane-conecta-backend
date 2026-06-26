import { Notification, NotificationDelivery } from "../models/index.js";
import { asyncHandler } from "../utils/http.js";
import { sendPushToTokens } from "../services/notificationService.js";
import { normalizeFilters, normalizeTargetType, resolveNotificationTargets, getUserTokens } from "../services/notificationTargetService.js";

export const listNotifications = asyncHandler(async (_req, res) => {
  const data = await Notification.find().sort({ createdAt: -1 }).limit(200);
  res.json({ data });
});

export const getNotification = asyncHandler(async (req, res) => {
  const data = await Notification.findById(req.params.id);
  if (!data) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }
  res.json({ data });
});

export const previewNotificationTargets = asyncHandler(async (req, res) => {
  const targetObj = req.body.audienceType
    ? req.body
    : {
        targetType: normalizeTargetType(req.body.targetType),
        targetFilters: normalizeFilters(req.body.targetFilters ?? {})
      };
  const preview = await resolveNotificationTargets(targetObj);
  res.json({ totalRecipients: preview.totalRecipients, breakdown: preview.breakdown });
});

export const createNotification = asyncHandler(async (req: any, res) => {
  const audienceType = req.body.audienceType ?? (req.body.targetType === "ALL" ? "all" : "segmented");
  const targetNeighborhoods = req.body.targetNeighborhoods ?? req.body.targetFilters?.neighborhoods ?? [];
  const targetCommunities = req.body.targetCommunities ?? req.body.targetFilters?.communities ?? [];
  const targetRoles = req.body.targetRoles ?? req.body.targetFilters?.roles ?? [];
  const targetProfiles = req.body.targetProfiles ?? req.body.targetFilters?.profiles ?? [];
  const targetInterests = req.body.targetInterests ?? req.body.targetFilters?.interests ?? [];
  const targetUserIds = req.body.targetUserIds ?? req.body.targetFilters?.userIds ?? [];
  const targetAgeRange = req.body.targetAgeRange ?? {
    min: req.body.targetFilters?.ageMin,
    max: req.body.targetFilters?.ageMax
  };

  const targetType = req.body.targetType ?? (audienceType === "all" ? "ALL" : "NEIGHBORHOOD");
  const targetFilters = {
    neighborhoods: targetNeighborhoods,
    communities: targetCommunities,
    roles: targetRoles,
    profiles: targetProfiles,
    interests: targetInterests,
    userIds: targetUserIds,
    ageMin: targetAgeRange?.min,
    ageMax: targetAgeRange?.max
  };

  const preview = await resolveNotificationTargets({
    targetType,
    targetFilters,
    audienceType,
    targetNeighborhoods,
    targetCommunities,
    targetRoles,
    targetProfiles,
    targetInterests,
    targetUserIds,
    targetAgeRange
  });

  const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined;
  const recurrence = req.body.recurrence ?? "NONE";
  const isScheduled = scheduledAt && scheduledAt > new Date();

  const notification = await Notification.create({
    title: req.body.title,
    message: req.body.message ?? req.body.body,
    body: req.body.body ?? req.body.message,
    targetType,
    targetFilters,
    audienceType,
    targetNeighborhoods,
    targetCommunities,
    targetRoles,
    targetProfiles,
    targetInterests,
    targetUserIds,
    targetAgeRange,
    recipientCount: preview.totalRecipients,
    recipientsCount: preview.totalRecipients,
    recipientIds: preview.users.map(u => u._id),
    scheduledAt,
    recurrence,
    status: isScheduled ? "SCHEDULED" : (req.body.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT"),
    createdBy: req.user?.id
  });

  if (req.body.sendNow && !isScheduled) {
    if (preview.totalRecipients === 0) {
      const lastError = (preview as any).lastError || "Nenhum usuário elegível com expoPushToken válido encontrado.";
      notification.set("recipientCount", 0);
      notification.set("recipientsCount", 0);
      notification.set("recipientIds", []);
      notification.set("sentCount", 0);
      notification.set("failedTokensCount", 0);
      notification.set("status", "no_recipients");
      notification.set("sentAt", new Date());
      notification.set("lastError", lastError);
      await notification.save();
      res.status(201).json({
        data: notification,
        delivery: { sent: 0, failed: 0, skipped: true, requested: 0, lastError },
        preview: { totalRecipients: 0, breakdown: preview.breakdown }
      });
      return;
    }

    const recipients = preview.users;
    const recipientIds = recipients.map(u => u._id);
    const tokens = recipients.flatMap(getUserTokens);

    console.log("[NOTIFICATION_RECIPIENTS_FINAL]", recipients.map(u => ({
      id: u._id,
      name: u.name,
      email: (u as any).email,
      role: u.role,
      neighborhood: u.neighborhood,
      neighborhoodName: u.neighborhoodName || (u as any).neighborhood
    })));

    console.log("[NOTIFICATION_DELIVERY_RECIPIENTS]", recipientIds);
    console.log("[NOTIFICATION_PUSH_TOKENS_FROM_RECIPIENTS]", tokens);

    console.log("[NOTIFICATION_PUSH_USERS]", recipients.map(u => ({
      name: u.name,
      email: (u as any).email,
      token: getUserTokens(u)
    })));

    let result: any;
    let failedCount = 0;
    let sentCount = 0;
    let finalStatus = "FAILED";

    if (tokens.length === 0) {
      console.log(`[NOTIFICATION_AUDIT] RESULTADO: ${recipients.length} destinatários encontrados, mas 0 tokens válidos.`);
      result = { sent: 0, skipped: true, requested: 0, failed: recipients.length, lastError: "Usuário sem Expo Push Token válido" };
      failedCount = recipients.length;
    } else {
      result = await sendPushToTokens(tokens, notification.get("title"), notification.get("message") ?? notification.get("body"), req.body.data || {});
      failedCount = (result as any).failed ?? 0;
      sentCount = result.sent;
      finalStatus = sentCount > 0 ? "SENT" : "FAILED";
    }

    notification.set("recipientCount", preview.totalRecipients);
    notification.set("sentCount", sentCount);
    notification.set("failedTokensCount", failedCount);
    
    // Novos campos
    notification.set("recipientsCount", preview.totalRecipients);
    notification.set("recipientIds", recipients.map(r => r._id));
    notification.set("successCount", sentCount);
    notification.set("failureCount", failedCount);
    notification.set("sentBy", req.user?.id);
    notification.set("provider", "EXPO");
    notification.set("status", finalStatus);
    notification.set("sentAt", new Date());
    notification.set("lastError", result.lastError || null);
    if (result.providerResponse) {
      notification.set("providerResponse", {
        tickets: result.providerResponse,
        successCount: sentCount,
        failureCount: failedCount
      });
    }
    await notification.save();

    // Registrar entregas
    const deliveries = preview.users.map((u) => ({
      notificationId: notification._id,
      userId: u._id,
      status: "SENT",
      deliveredAt: new Date()
    }));
    if (deliveries.length > 0) {
      await NotificationDelivery.insertMany(deliveries);
    }

    res.status(201).json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
    return;
  }

  res.status(201).json({ data: notification, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});

export const updateNotification = asyncHandler(async (req: any, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }

  const audienceType = req.body.audienceType ?? notification.get("audienceType") ?? (req.body.targetType === "ALL" ? "all" : "segmented");
  const targetNeighborhoods = req.body.targetNeighborhoods ?? req.body.targetFilters?.neighborhoods ?? notification.get("targetNeighborhoods") ?? [];
  const targetCommunities = req.body.targetCommunities ?? req.body.targetFilters?.communities ?? notification.get("targetCommunities") ?? [];
  const targetRoles = req.body.targetRoles ?? req.body.targetFilters?.roles ?? notification.get("targetRoles") ?? [];
  const targetProfiles = req.body.targetProfiles ?? req.body.targetFilters?.profiles ?? notification.get("targetProfiles") ?? [];
  const targetInterests = req.body.targetInterests ?? req.body.targetFilters?.interests ?? notification.get("targetInterests") ?? [];
  const targetUserIds = req.body.targetUserIds ?? req.body.targetFilters?.userIds ?? notification.get("targetUserIds") ?? [];
  const targetAgeRange = req.body.targetAgeRange ?? (req.body.targetFilters ? {
    min: req.body.targetFilters?.ageMin,
    max: req.body.targetFilters?.ageMax
  } : notification.get("targetAgeRange"));

  const targetType = req.body.targetType ?? notification.get("targetType") ?? (audienceType === "all" ? "ALL" : "NEIGHBORHOOD");
  const targetFilters = req.body.targetFilters ?? {
    neighborhoods: targetNeighborhoods,
    communities: targetCommunities,
    roles: targetRoles,
    profiles: targetProfiles,
    interests: targetInterests,
    userIds: targetUserIds,
    ageMin: targetAgeRange?.min,
    ageMax: targetAgeRange?.max
  };

  const preview = await resolveNotificationTargets({
    targetType,
    targetFilters,
    audienceType,
    targetNeighborhoods,
    targetCommunities,
    targetRoles,
    targetProfiles,
    targetInterests,
    targetUserIds,
    targetAgeRange
  });

  const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : notification.get("scheduledAt");
  const recurrence = req.body.recurrence ?? notification.get("recurrence") ?? "NONE";
  const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

  const updated = await Notification.findByIdAndUpdate(
    req.params.id,
    {
      title: req.body.title ?? notification.get("title"),
      message: req.body.message ?? req.body.body ?? notification.get("message"),
      body: req.body.body ?? req.body.message ?? notification.get("body"),
      targetType,
      targetFilters,
      audienceType,
      targetNeighborhoods,
      targetCommunities,
      targetRoles,
      targetProfiles,
      targetInterests,
      targetUserIds,
      targetAgeRange,
      recipientCount: preview.totalRecipients,
      recipientsCount: preview.totalRecipients,
      recipientIds: preview.users.map(u => u._id),
      scheduledAt,
      recurrence,
      status: isScheduled ? "SCHEDULED" : (notification.get("status") === "SENT" ? "SENT" : "DRAFT")
    },
    { new: true }
  );
  res.json({ data: updated, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});

export const sendNotification = asyncHandler(async (req: any, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }

  const targetObj = {
    targetType: notification.get("targetType") || (notification.get("audienceType") === "all" ? "ALL" : "NEIGHBORHOOD"),
    audienceType: notification.get("audienceType") || (notification.get("targetType") === "ALL" ? "all" : "segmented"),
    targetNeighborhoods: notification.get("targetNeighborhoods") || notification.get("targetFilters")?.neighborhoods || [],
    targetCommunities: notification.get("targetCommunities") || notification.get("targetFilters")?.communities || [],
    targetRoles: notification.get("targetRoles") || notification.get("targetFilters")?.roles || [],
    targetProfiles: notification.get("targetProfiles") || notification.get("targetFilters")?.profiles || [],
    targetInterests: notification.get("targetInterests") || notification.get("targetFilters")?.interests || [],
    targetUserIds: notification.get("targetUserIds") || notification.get("targetFilters")?.userIds || [],
    targetAgeRange: notification.get("targetAgeRange") || {
      min: notification.get("targetFilters")?.ageMin,
      max: notification.get("targetFilters")?.ageMax
    }
  };

  console.log("[NOTIFICATION_AUDIT] ====== INICIANDO ENVIO DE NOTIFICAÇÃO ======");
  console.log(`[NOTIFICATION_AUDIT] id da notificação: ${notification.get("_id")}`);
  console.log(`[NOTIFICATION_AUDIT] título: ${notification.get("title")}`);

  const preview = await resolveNotificationTargets(targetObj);

  if (preview.totalRecipients === 0) {
    const lastError = (preview as any).lastError || "Nenhum usuário elegível com expoPushToken válido encontrado.";
    console.log(`[NOTIFICATION_AUDIT] RESULTADO: 0 destinatarios — ${lastError}`);
    notification.set("recipientCount", 0);
    notification.set("recipientsCount", 0);
    notification.set("recipientIds", []);
    notification.set("sentCount", 0);
    notification.set("failedTokensCount", 0);
    notification.set("status", "no_recipients");
    notification.set("sentAt", new Date());
    notification.set("lastError", lastError);
    await notification.save();
    res.json({ data: notification, delivery: { sent: 0, failed: 0, skipped: true, requested: 0, lastError }, preview: { totalRecipients: 0, breakdown: preview.breakdown } });
    return;
  }

  const recipients = preview.users;
  const recipientIds = recipients.map(u => u._id);
  const tokens = recipients.flatMap(getUserTokens);

  console.log("[NOTIFICATION_RECIPIENTS_FINAL]", recipients.map(u => ({
    id: u._id,
    name: u.name,
    email: (u as any).email,
    role: u.role,
    neighborhood: u.neighborhood,
    neighborhoodName: u.neighborhoodName || (u as any).neighborhood
  })));

  console.log("[NOTIFICATION_DELIVERY_RECIPIENTS]", recipientIds);
  console.log("[NOTIFICATION_PUSH_TOKENS_FROM_RECIPIENTS]", tokens);

  console.log("[NOTIFICATION_PUSH_USERS]", recipients.map(u => ({
    name: u.name,
    email: (u as any).email,
    token: getUserTokens(u)
  })));

  let result: any;
  if (tokens.length === 0) {
    console.log(`[NOTIFICATION_AUDIT] RESULTADO: ${recipients.length} destinatários encontrados, mas 0 tokens válidos.`);
    result = { sent: 0, skipped: true, requested: 0, failed: recipients.length, lastError: "Usuário sem Expo Push Token válido" };
  } else {
    result = await sendPushToTokens(tokens, notification.get("title"), notification.get("message") ?? notification.get("body"), notification.get("data") || {});
    console.log(`[NOTIFICATION_AUDIT] resumo do provedor push: sent=${result.sent} failed=${result.failed ?? 0} invalid=${(result as any).invalidTokensCount ?? 0}`);
    if (result.lastError) console.log(`[NOTIFICATION_AUDIT] lastError: ${result.lastError}`);
  }

  const newStatus = result.sent > 0 ? "SENT" : "FAILED";
  const failedCount = result.failed ?? 0;

  notification.set("recipientCount", preview.totalRecipients);
  notification.set("sentCount", result.sent);
  notification.set("failedTokensCount", failedCount);

  // Novos campos
  notification.set("recipientsCount", preview.totalRecipients);
  notification.set("recipientIds", preview.users.map(u => u._id));
  notification.set("successCount", result.sent);
  notification.set("failureCount", failedCount);
  notification.set("sentBy", req.user?.id);
  notification.set("provider", "EXPO");
  notification.set("status", newStatus);
  notification.set("sentAt", new Date());
  notification.set("lastError", result.lastError || null);
  if (result.providerResponse) {
    notification.set("providerResponse", {
      tickets: result.providerResponse,
      successCount: result.sent,
      failureCount: failedCount
    });
  }
  await notification.save();

  // Registrar entregas
  const deliveries = preview.users.map((u) => ({
    notificationId: notification._id,
    userId: u._id,
    status: "SENT",
    deliveredAt: new Date()
  }));
  if (deliveries.length > 0) {
    await NotificationDelivery.insertMany(deliveries);
  }

  console.log(`[NOTIFICATION_AUDIT] status final: ${newStatus} | enviados: ${result.sent} / ${preview.totalRecipients}`);
  res.json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});

export const createAndSendNotification = asyncHandler(async (req: any, res) => {
  const audienceType = req.body.audienceType ?? (req.body.targetType === "ALL" ? "all" : "segmented");
  const targetNeighborhoods = req.body.targetNeighborhoods ?? req.body.targetFilters?.neighborhoods ?? [];
  const targetCommunities = req.body.targetCommunities ?? req.body.targetFilters?.communities ?? [];
  const targetRoles = req.body.targetRoles ?? req.body.targetFilters?.roles ?? [];
  const targetProfiles = req.body.targetProfiles ?? req.body.targetFilters?.profiles ?? [];
  const targetInterests = req.body.targetInterests ?? req.body.targetFilters?.interests ?? [];
  const targetUserIds = req.body.targetUserIds ?? req.body.targetFilters?.userIds ?? [];
  const targetAgeRange = req.body.targetAgeRange ?? {
    min: req.body.targetFilters?.ageMin,
    max: req.body.targetFilters?.ageMax
  };

  const targetType = req.body.targetType ?? (audienceType === "all" ? "ALL" : "NEIGHBORHOOD");
  const targetFilters = {
    neighborhoods: targetNeighborhoods,
    communities: targetCommunities,
    roles: targetRoles,
    profiles: targetProfiles,
    interests: targetInterests,
    userIds: targetUserIds,
    ageMin: targetAgeRange?.min,
    ageMax: targetAgeRange?.max
  };

  console.log("[NOTIFICATION_AUDIT] ====== CRIAR E ENVIAR NOTIFICAÇÃO ======");
  console.log(`[NOTIFICATION_AUDIT] audienceType: ${audienceType}`);

  const preview = await resolveNotificationTargets({
    targetType,
    targetFilters,
    audienceType,
    targetNeighborhoods,
    targetCommunities,
    targetRoles,
    targetProfiles,
    targetInterests,
    targetUserIds,
    targetAgeRange
  });

  let result: any;
  let finalStatus: string;

  if (preview.totalRecipients === 0) {
    const lastError = (preview as any).lastError || "Nenhum usuário elegível com expoPushToken válido encontrado.";
    console.log(`[NOTIFICATION_AUDIT] RESULTADO: 0 destinatarios — ${lastError}`);
    result = { sent: 0, skipped: true, requested: 0, failed: 0, lastError };
    finalStatus = "no_recipients";
  } else {
    const recipients = preview.users;
    const recipientIds = recipients.map(u => u._id);
    const tokens = recipients.flatMap(getUserTokens);

    console.log("[NOTIFICATION_RECIPIENTS_FINAL]", recipients.map(u => ({
      id: u._id,
      name: u.name,
      email: (u as any).email,
      role: u.role,
      neighborhood: u.neighborhood,
      neighborhoodName: u.neighborhoodName || (u as any).neighborhood
    })));

    console.log("[NOTIFICATION_DELIVERY_RECIPIENTS]", recipientIds);
    console.log("[NOTIFICATION_PUSH_TOKENS_FROM_RECIPIENTS]", tokens);

    console.log("[NOTIFICATION_PUSH_USERS]", recipients.map(u => ({
      name: u.name,
      email: (u as any).email,
      token: getUserTokens(u)
    })));

    if (tokens.length === 0) {
      console.log(`[NOTIFICATION_AUDIT] RESULTADO: ${recipients.length} destinatários encontrados, mas 0 tokens válidos.`);
      result = { sent: 0, skipped: true, requested: 0, failed: recipients.length, lastError: "Usuário sem Expo Push Token válido" };
      finalStatus = "FAILED";
    } else {
      result = await sendPushToTokens(tokens, req.body.title, req.body.message ?? req.body.body, req.body.data || {});
      const failedCount = result.failed ?? 0;
      console.log(`[NOTIFICATION_AUDIT] resumo do provedor push: sent=${result.sent} failed=${failedCount} invalid=${(result as any).invalidTokensCount ?? 0}`);
      if (result.lastError) console.log(`[NOTIFICATION_AUDIT] lastError: ${result.lastError}`);
      finalStatus = result.sent > 0 ? "SENT" : "FAILED";
      console.log(`[NOTIFICATION_AUDIT] status final: ${finalStatus} | enviados: ${result.sent} / ${preview.totalRecipients}`);
    }
  }
  const notification = await Notification.create({
    title: req.body.title,
    message: req.body.message ?? req.body.body,
    body: req.body.body ?? req.body.message,
    targetType,
    targetFilters,
    audienceType,
    targetNeighborhoods,
    targetCommunities,
    targetRoles,
    targetProfiles,
    targetInterests,
    targetUserIds,
    targetAgeRange,
    recipientCount: preview.totalRecipients,
    sentCount: result.sent,
    failedTokensCount: result.failed ?? 0,

    recipientsCount: preview.totalRecipients,
    recipientIds: preview.users.map(u => u._id),
    successCount: result.sent,
    failureCount: result.failed ?? 0,
    sentBy: req.user?.id,
    provider: "EXPO",
    recurrence: "NONE",
    status: finalStatus,
    createdBy: req.user?.id,
    sentAt: new Date(),
    lastError: result.lastError || null,
    providerResponse: result.providerResponse ? {
      tickets: result.providerResponse,
      successCount: result.sent,
      failureCount: result.failed ?? 0
    } : undefined
  });

  // Registrar entregas
  if (finalStatus === "SENT" && preview.users.length > 0) {
    const deliveries = preview.users.map((u) => ({
      notificationId: notification._id,
      userId: u._id,
      status: "SENT",
      deliveredAt: new Date()
    }));
    await NotificationDelivery.insertMany(deliveries);
  }

  res.status(201).json({ data: notification, delivery: result, preview: { totalRecipients: preview.totalRecipients, breakdown: preview.breakdown } });
});

/** POST /api/notifications/:id/open — incrementa openedCount (chamado pelo app mobile) */
export const trackOpen = asyncHandler(async (req, res) => {
  const updated = await Notification.findByIdAndUpdate(
    req.params.id,
    { $inc: { openedCount: 1 } },
    { new: true }
  );
  if (!updated) { res.status(404).json({ message: "Notification not found" }); return; }
  res.json({ ok: true });
});

/** POST /api/notifications/:id/click — incrementa clickedCount (chamado pelo app mobile) */
export const trackClick = asyncHandler(async (req, res) => {
  const updated = await Notification.findByIdAndUpdate(
    req.params.id,
    { $inc: { clickedCount: 1 } },
    { new: true }
  );
  if (!updated) { res.status(404).json({ message: "Notification not found" }); return; }
  res.json({ ok: true });
});

/** GET /api/notifications/stats — métricas agregadas de todas as notificações */
export const notificationStats = asyncHandler(async (_req, res) => {
  const result = await Notification.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ["$status", "SENT"] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ["$status", "SCHEDULED"] }, 1, 0] } },
        drafts: { $sum: { $cond: [{ $eq: ["$status", "DRAFT"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
        totalRecipients: { $sum: "$recipientCount" },
        totalSent: { $sum: "$sentCount" },
        totalDelivered: { $sum: "$deliveredCount" },
        totalOpened: { $sum: "$openedCount" },
        totalClicked: { $sum: "$clickedCount" }
      }
    }
  ]);

  const stats = result[0] ?? {
    total: 0, sent: 0, scheduled: 0, drafts: 0, failed: 0,
    totalRecipients: 0, totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0
  };

  const openRate = stats.totalSent > 0 ? Math.round((stats.totalOpened / stats.totalSent) * 100) : 0;
  const clickRate = stats.totalOpened > 0 ? Math.round((stats.totalClicked / stats.totalOpened) * 100) : 0;

  res.json({
    data: {
      ...stats,
      openRate,
      clickRate
    }
  });
});

/** GET /api/notifications/my — histórico do usuário logado */
export const listMyNotifications = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  
  const deliveries = await NotificationDelivery.find({ userId })
    .populate("notificationId")
    .sort({ createdAt: -1 })
    .limit(100);

  const mapped = deliveries
    .filter(d => d.notificationId)
    .map(d => {
      const notif = d.notificationId as any;
      return {
        _id: notif._id,
        deliveryId: d._id,
        title: notif.title,
        body: notif.body || notif.message,
        message: notif.message || notif.body,
        status: d.status,
        isRead: d.status === "READ",
        createdAt: notif.createdAt,
        sentAt: notif.sentAt,
        targetType: notif.targetType
      };
    });

  res.json({ data: mapped });
});

/** GET /api/notifications/unread-count — obter contagem de notificações não lidas */
export const getMyUnreadCount = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  const count = await NotificationDelivery.countDocuments({
    userId,
    status: "SENT"
  });
  res.json({ data: { count } });
});

/** POST /api/notifications/:id/read — marcar como lida */
export const markNotificationAsRead = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  const delivery = await NotificationDelivery.findOneAndUpdate(
    { notificationId, userId },
    { $set: { status: "READ", readAt: new Date() } },
    { new: true }
  );

  if (!delivery) {
    // Tentar encontrar e criar se o usuário for elegível, ou apenas retornar 404 se não houver registro
    res.status(404).json({ message: "Registro de entrega da notificação não encontrado." });
    return;
  }

  res.json({ success: true, ok: true, message: "Notificação marcada como lida." });
});

/** POST /api/notifications/read-all — marcar todas as notificações do usuário como lidas */
export const markAllNotificationsAsRead = asyncHandler(async (req: any, res) => {
  const userId = req.user.id;
  await NotificationDelivery.updateMany(
    { userId, status: "SENT" },
    { $set: { status: "READ", readAt: new Date() } }
  );
  res.json({ success: true, ok: true, message: "Todas as notificações foram marcadas como lidas." });
});

