import { CitizenActivity, User } from "../models/index.js";
const pointsByType = {
    SURVEY_VOTE: 10,
    EVENT_ATTENDANCE: 20,
    DEMAND_CREATED: 15,
    DEMAND_RESOLVED: 30
};
function levelFor(points) {
    if (points >= 1000)
        return "DIAMANTE";
    if (points >= 500)
        return "OURO";
    if (points >= 150)
        return "PRATA";
    return "BRONZE";
}
export async function registerActivity(userId, type, referenceId) {
    const points = pointsByType[type] ?? 0;
    await CitizenActivity.create({ userId, type, referenceId, points });
    const user = await User.findByIdAndUpdate(userId, { $inc: { points } }, { new: true });
    if (user) {
        user.set("level", levelFor(user.get("points")));
        await user.save();
    }
}
