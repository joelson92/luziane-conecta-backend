import { z } from "zod";
import { fetchAddressByZipCode, geocodeAddress, normalizeZipCode } from "../services/geocodingService.js";
import { asyncHandler, AppError } from "../utils/http.js";

const cepSchema = z.object({
  zipCode: z.string().min(8)
});

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhoodName: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(2),
  zipCode: z.string().optional()
});

export const lookupCep = asyncHandler(async (req, res) => {
  const input = cepSchema.parse(req.body);
  const cleanZipCode = normalizeZipCode(input.zipCode);
  if (!cleanZipCode) throw new AppError(400, "CEP invalido.");
  const result = await fetchAddressByZipCode(cleanZipCode);
  if (!result) throw new AppError(404, "CEP nao encontrado. Verifique o numero informado.");
  res.json({ data: result });
});

export const lookupAddress = asyncHandler(async (req, res) => {
  const input = addressSchema.parse(req.body);
  const result = await geocodeAddress(input);
  if (!result) {
    res.status(404).json({
      data: {
        latitude: null,
        longitude: null,
        formattedAddress: "",
        geocodingStatus: "FAILED"
      },
      message: "Nao foi possivel localizar o endereco no mapa. Verifique rua, numero e bairro."
    });
    return;
  }
  res.json({
    data: {
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
      geocodingStatus: "SUCCESS"
    }
  });
});
