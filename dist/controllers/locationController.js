import { states, municipalities } from "../data/brazilLocations.js";
import { asyncHandler } from "../utils/http.js";
export const getStates = asyncHandler(async (req, res) => {
    res.json(states);
});
export const getMunicipalities = asyncHandler(async (req, res) => {
    const uf = typeof req.query.uf === "string" ? req.query.uf.toUpperCase() : "";
    if (!uf) {
        res.json([]);
        return;
    }
    const filtered = municipalities.filter((m) => m.uf.toUpperCase() === uf);
    res.json(filtered);
});
