import { InternalNotification } from "../models/InternalNotification.js";

export async function handleModelCreate(modelName: string, doc: any) {
  try {
    if (modelName === "Video" && doc.status === "published") {
      await createVideoNotification(doc);
    } else if (modelName === "Post" && doc.status === "published") {
      await createPostNotification(doc);
    } else if (modelName === "Event" && doc.isPublished) {
      await createEventNotification(doc);
    } else if (modelName === "Survey" && doc.isActive) {
      await createSurveyNotification(doc);
    } else if (modelName === "Demand") {
      await createDemandNotification(doc, "registrada");
    }
  } catch (err) {
    console.error("Error creating internal notification:", err);
  }
}

export async function handleModelUpdate(modelName: string, doc: any) {
  try {
    if (modelName === "Video" && doc.status === "published") {
      await createVideoNotification(doc);
    } else if (modelName === "Post" && doc.status === "published") {
      await createPostNotification(doc);
    } else if (modelName === "Event" && doc.isPublished) {
      await createEventNotification(doc);
    } else if (modelName === "Survey" && doc.isActive) {
      await createSurveyNotification(doc);
    } else if (modelName === "Demand") {
      await createDemandNotification(doc, "atualizada");
    }
  } catch (err) {
    console.error("Error updating internal notification:", err);
  }
}

async function createVideoNotification(video: any) {
  const referenceId = video._id.toString();
  const exists = await InternalNotification.findOne({ type: "video", referenceId });
  if (exists) return;

  await InternalNotification.create({
    type: "video",
    title: "🎥 Novo vídeo publicado",
    body: video.title,
    referenceId
  });
}

async function createPostNotification(post: any) {
  const referenceId = post._id.toString();
  const exists = await InternalNotification.findOne({ type: "post", referenceId });
  if (exists) return;

  await InternalNotification.create({
    type: "post",
    title: "📢 Novo comunicado",
    body: post.title,
    referenceId
  });
}

async function createEventNotification(event: any) {
  const referenceId = event._id.toString();
  const exists = await InternalNotification.findOne({ type: "event", referenceId });
  if (exists) return;

  await InternalNotification.create({
    type: "event",
    title: "📅 Novo evento",
    body: event.title + (event.locationName ? ` em ${event.locationName}` : ""),
    referenceId
  });
}

async function createSurveyNotification(survey: any) {
  const referenceId = survey._id.toString();
  const exists = await InternalNotification.findOne({ type: "poll", referenceId });
  if (exists) return;

  await InternalNotification.create({
    type: "poll",
    title: "📊 Nova enquete",
    body: survey.title,
    referenceId
  });
}

async function createDemandNotification(demand: any, actionType: "registrada" | "atualizada") {
  const citizenId = demand.citizenId || demand.get?.("citizenId");
  if (!citizenId) return;

  const referenceId = demand._id.toString();
  let body = "";
  if (actionType === "registrada") {
    body = `Sua demanda "${demand.title}" foi registrada com sucesso.`;
  } else {
    const rawStatus = String(demand.status).toLowerCase();
    let statusText = "Nova";
    if (rawStatus === "em_analise" || rawStatus === "em_atendimento" || rawStatus === "em andamento" || rawStatus === "resolvido" || rawStatus === "resolvida") {
      if (rawStatus === "em_atendimento" || rawStatus === "em andamento") {
        statusText = "Em andamento";
      } else if (rawStatus === "resolvido" || rawStatus === "resolvida") {
        statusText = "Resolvida";
      } else if (rawStatus === "em_analise") {
        statusText = "Em análise";
      }
    }
    body = `Sua demanda "${demand.title}" está com status: ${statusText}.`;
  }

  // To prevent posting exactly duplicate status update notification in database
  const exists = await InternalNotification.findOne({
    userId: citizenId,
    type: "demand_update",
    referenceId,
    body
  });
  if (exists) return;

  await InternalNotification.create({
    userId: citizenId,
    type: "demand_update",
    title: actionType === "registrada" ? "📲 Demanda registrada" : "📲 Atualização de demanda",
    body,
    referenceId,
    isRead: false
  });
}
