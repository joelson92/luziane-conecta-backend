import { SystemSettings } from "../models/index.js";
import { asyncHandler } from "../utils/http.js";
async function getSettingsDocument() {
    return SystemSettings.findOneAndUpdate({}, { $setOnInsert: { appDownloads: 0 } }, { upsert: true, new: true });
}
export const getSettings = asyncHandler(async (_req, res) => {
    const settings = await getSettingsDocument();
    res.json({ data: settings });
});
export const updateSettings = asyncHandler(async (req, res) => {
    const appDownloads = Number(req.body.appDownloads ?? 0);
    const settings = await SystemSettings.findOneAndUpdate({}, { $set: { appDownloads } }, { upsert: true, new: true });
    res.json({ data: settings });
});
