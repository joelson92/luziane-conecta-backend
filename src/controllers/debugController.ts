import { z } from "zod";
import { buildFullAddress, enrichAddressFromZipCode, geocodeAddress } from "../services/geocodingService.js";
import { enrichNeighborhoodPayload } from "../services/neighborhoodService.js";
import { asyncHandler } from "../utils/http.js";

const cepTestSchema = z.object({
  zipCode: z.string(),
  number: z.string().optional()
});

export const cepTest = asyncHandler(async (req, res) => {
  const input = cepTestSchema.parse(req.body);
  const viaCepPayload = await enrichAddressFromZipCode<Record<string, any>>({ zipCode: input.zipCode, number: input.number });
  const withNeighborhood = await enrichNeighborhoodPayload(viaCepPayload);
  const fullAddress = buildFullAddress(withNeighborhood);
  const geocoding = await geocodeAddress(withNeighborhood);
  const finalPayload = {
    ...withNeighborhood,
    latitude: geocoding?.latitude,
    longitude: geocoding?.longitude,
    geocodingStatus: geocoding ? "SUCCESS" : "FAILED",
    geocodedAt: geocoding ? new Date() : undefined,
    geocodingProvider: geocoding ? "nominatim" : undefined
  };

  res.json({
    viacep: viaCepPayload,
    neighborhood: withNeighborhood.neighborhoodId ? {
      id: withNeighborhood.neighborhoodId,
      name: withNeighborhood.neighborhoodName
    } : null,
    fullAddress,
    geocoding,
    finalPayload
  });
});
