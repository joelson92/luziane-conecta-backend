import { Router } from "express";
import { getStates, getMunicipalities } from "../controllers/locationController.js";
export const locationRoutes = Router();
locationRoutes.get("/states", getStates);
locationRoutes.get("/municipalities", getMunicipalities);
