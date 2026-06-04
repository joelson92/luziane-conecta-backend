import { Demand, Event, Post, Survey } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";
import { registerActivity } from "../services/gamificationService.js";

export const likePost = asyncHandler(async (req: any, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $addToSet: { likes: req.user.id } }, { new: true });
  if (!post) throw new AppError(404, "Post not found");
  res.json({ data: post });
});

export const viewPost = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
  if (!post) throw new AppError(404, "Post not found");
  res.json({ data: post });
});

export const sharePost = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { shares: 1 } }, { new: true });
  if (!post) throw new AppError(404, "Post not found");
  res.json({ data: post });
});

export const attendEvent = asyncHandler(async (req: any, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, { $addToSet: { attendees: req.user.id } }, { new: true });
  if (!event) throw new AppError(404, "Event not found");
  await registerActivity(req.user.id, "EVENT_ATTENDANCE", req.params.id);
  res.json({ data: event });
});

export const voteSurvey = asyncHandler(async (req: any, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) throw new AppError(404, "Survey not found");
  if (survey.get("options").some((option: any) => option.votes.map(String).includes(req.user.id))) {
    throw new AppError(409, "User already voted");
  }
  const option = survey.get("options").id(req.body.optionId);
  if (!option) throw new AppError(404, "Option not found");
  option.votes.push(req.user.id);
  await survey.save();
  await registerActivity(req.user.id, "SURVEY_VOTE", req.params.id);
  res.json({ data: survey });
});

export const resolveDemand = asyncHandler(async (req, res) => {
  const demand = await Demand.findByIdAndUpdate(req.params.id, { status: "RESOLVIDO", resolvedAt: new Date() }, { new: true });
  if (!demand) throw new AppError(404, "Demand not found");
  await registerActivity(String(demand.get("citizenId")), "DEMAND_RESOLVED", req.params.id);
  res.json({ data: demand });
});
