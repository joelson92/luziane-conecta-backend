import { CitizenActivity, Demand, Event, Survey, User } from "../models/index.js";
import { asyncHandler, AppError } from "../utils/http.js";

export const citizenProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId).select("-passwordHash -refreshTokenHash");
  if (!user) throw new AppError(404, "Citizen not found");
  const [demands, activities, events, surveys] = await Promise.all([
    Demand.find({ citizenId: req.params.userId }).sort({ createdAt: -1 }),
    CitizenActivity.find({ userId: req.params.userId }).sort({ createdAt: -1 }),
    Event.find({ attendees: req.params.userId }).sort({ startDate: -1 }),
    Survey.find({ "options.votes": req.params.userId }).sort({ createdAt: -1 })
  ]);
  res.json({ user, demands, activities, events, surveys });
});
