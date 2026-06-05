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

export const searchAddress = asyncHandler(async (req, res) => {
  const q = req.query.q ? String(req.query.q).trim() : "";
  const city = req.query.city ? String(req.query.city).trim() : "";
  const state = req.query.state ? String(req.query.state).trim() : "";

  if (!q) {
    res.json([]);
    return;
  }

  const queryParts = [q];
  if (city) queryParts.push(city);
  if (state) queryParts.push(state);
  queryParts.push("Brasil");

  const fullQuery = queryParts.filter(Boolean).join(", ");
  console.log("[SEARCH_ADDRESS_QUERY]", fullQuery);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", fullQuery);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LuzianeConectaAppProductionGeocodingService/2.0 (contato@luzianeconecta.com.br)"
      }
    });

    if (!response.ok) {
      res.json([]);
      return;
    }

    const data = (await response.json()) as any[];
    const suggestions = data.map((item) => {
      const addr = item.address || {};
      const street = addr.road || addr.pedestrian || addr.footway || addr.path || addr.square || addr.avenue || addr.street || "";
      const neighborhoodName = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.residential || "";
      const resCity = addr.city || addr.town || addr.village || addr.municipality || "";
      const resState = addr.state || "";

      return {
        label: item.display_name,
        street,
        neighborhoodName,
        city: resCity,
        state: resState,
        latitude: Number(item.lat),
        longitude: Number(item.lon)
      };
    }).filter((item) => {
      const normalizedCity = String(item.city).normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
      const normalizedState = String(item.state).normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
      return normalizedCity === "benevides" && (normalizedState === "para" || normalizedState === "pa");
    });

    res.json(suggestions);
  } catch (error) {
    console.error("[SEARCH_ADDRESS_ERROR]", error);
    res.json([]);
  }
});

export const resolveAddress = asyncHandler(async (req, res) => {
  const { street, number, neighborhoodName, city, state } = req.body;
  if (!street || !number || !neighborhoodName || !city || !state) {
    throw new AppError(400, "street, number, neighborhoodName, city, state are required");
  }

  const result = await geocodeAddress({ street, number, neighborhoodName, city, state });
  if (!result) {
    throw new AppError(404, "Não foi possível resolver o endereço para coordenadas.");
  }

  res.json({
    latitude: result.latitude,
    longitude: result.longitude,
    formattedAddress: result.formattedAddress,
    precision: result.precision
  });
});
