type AddressInput = {
  street?: string;
  number?: string;
  neighborhood?: string;
  neighborhoodName?: string;
  community?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  confidence: number;
  provider: string;
};

const DEFAULT_COUNTRY = "Brasil";

export function buildFullAddress(address: AddressInput) {
  const neighborhood = address.neighborhoodName || address.neighborhood;
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    neighborhood,
    address.community,
    address.city,
    address.state,
    address.country || DEFAULT_COUNTRY,
    address.zipCode
  ]
    .filter(Boolean)
    .join(", ");
}

export async function geocodeAddress(address: AddressInput): Promise<GeocodeResult | null> {
  const attempts = buildAddressAttempts(address);
  if (!attempts.length) return null;

  for (const fullAddress of attempts) {
    console.log("[GEOCODING_FULL_ADDRESS]", fullAddress);
    const result = await geocodeAddressText(fullAddress);
    if (result) return result;
  }

  return null;
}

export async function fetchAddressByZipCode(zipCode: string) {
  const cleanZipCode = normalizeZipCode(zipCode);
  if (!cleanZipCode) return null;
  console.log("[CEP_INPUT]", cleanZipCode);

  const response = await fetch(`https://viacep.com.br/ws/${cleanZipCode}/json/`);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    erro?: boolean;
    cep?: string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  console.log("[VIACEP_RESPONSE]", data);
  if (data.erro) return null;

  return {
    zipCode: cleanZipCode,
    street: data.logradouro ?? "",
    neighborhoodName: data.bairro ?? "",
    neighborhood: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? ""
  };
}

export async function enrichAddressFromZipCode<T extends Record<string, any>>(payload: T): Promise<T> {
  const cleanZipCode = normalizeZipCode(payload.zipCode);
  if (!cleanZipCode) return payload;
  const viaCep = await fetchAddressByZipCode(cleanZipCode);
  if (!viaCep) return { ...payload, zipCode: cleanZipCode };
  return {
    ...payload,
    zipCode: cleanZipCode,
    street: payload.street || viaCep.street,
    neighborhoodName: payload.neighborhoodName || payload.neighborhood || viaCep.neighborhoodName,
    neighborhood: payload.neighborhood || payload.neighborhoodName || viaCep.neighborhoodName,
    city: payload.city || viaCep.city,
    state: payload.state || viaCep.state
  };
}

export function normalizeZipCode(zipCode?: string | null) {
  const clean = String(zipCode ?? "").replace(/\D/g, "");
  return clean.length === 8 ? clean : "";
}

async function geocodeAddressText(fullAddress: string): Promise<GeocodeResult | null> {
  if (!fullAddress.trim()) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", fullAddress);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "LuzianeConecta/1.0 contato@luzianeconecta.com"
    }
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Array<{ lat: string; lon: string; display_name: string; importance?: number }>;
  const first = data[0];
  if (!first) return null;

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    formattedAddress: first.display_name,
    confidence: Number(first.importance ?? 0.7),
    provider: "nominatim"
  };
}

export async function enrichUserAddress<T extends Record<string, any>>(payload: T): Promise<T> {
  const address = normalizeAddress(payload);
  if (!hasAddress(address)) return payload;
  const next = { country: DEFAULT_COUNTRY, ...payload };

  try {
    const result = await geocodeAddress(address);
    console.log("[GEOCODING_RESULT]", result);
    if (!result) return withFailedGeocoding(next);
    return {
      ...next,
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
      geocodedAt: new Date(),
      geocodingProvider: result.provider,
      geocodingStatus: "SUCCESS",
      geocodingConfidence: result.confidence
    };
  } catch {
    console.log("[GEOCODING_RESULT]", null);
    return withFailedGeocoding(next);
  }
}

export async function enrichDemandAddress<T extends Record<string, any>>(payload: T): Promise<T> {
  if (payload.location?.lat && payload.location?.lng) return payload;
  const source = payload.location?.source ?? "address";
  if (source !== "address") return payload;

  const address = normalizeAddress({ ...payload.address, neighborhood: payload.neighborhood, community: payload.community });
  if (!hasAddress(address)) return payload;

  try {
    const result = await geocodeAddress(address);
    if (!result) {
      return {
        ...payload,
        location: { ...(payload.location ?? {}), source: "address" },
        address: { ...payload.address, ...address, geocodingStatus: "failed", geocodingProvider: "openstreetmap-nominatim" }
      };
    }
    return {
      ...payload,
      location: { lat: result.latitude, lng: result.longitude, source: "address" },
      address: {
        ...payload.address,
        ...address,
        formattedAddress: result.formattedAddress,
        geocodedAt: new Date(),
        geocodingProvider: result.provider,
        geocodingStatus: "success",
        geocodingConfidence: result.confidence
      }
    };
  } catch {
    return {
      ...payload,
      location: { ...(payload.location ?? {}), source: "address" },
      address: { ...payload.address, ...address, geocodingStatus: "failed", geocodingProvider: "openstreetmap-nominatim" }
    };
  }
}

function normalizeAddress(payload: Record<string, any>): AddressInput {
  return {
    street: payload.street,
    number: payload.number,
    neighborhood: payload.neighborhood,
    neighborhoodName: payload.neighborhoodName,
    community: payload.community,
    city: payload.city,
    state: payload.state,
    country: payload.country || DEFAULT_COUNTRY,
    zipCode: payload.zipCode
  };
}

function hasAddress(address: AddressInput) {
  return Boolean(address.street || address.neighborhoodName || address.neighborhood || address.community || address.city || address.state || address.zipCode);
}

function withFailedGeocoding<T extends Record<string, any>>(payload: T): T {
  return {
    ...payload,
    latitude: null,
    longitude: null,
    geocodingProvider: "nominatim",
    geocodingStatus: "FAILED"
  };
}

function buildAddressAttempts(address: AddressInput) {
  const neighborhood = address.neighborhoodName || address.neighborhood;
  const attempts = [
    [[address.street, address.number].filter(Boolean).join(", "), neighborhood, address.city, address.state, DEFAULT_COUNTRY],
    [address.street, neighborhood, address.city, address.state, DEFAULT_COUNTRY],
    [neighborhood, address.city, address.state, DEFAULT_COUNTRY],
    [address.city, address.state, DEFAULT_COUNTRY]
  ]
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter((value) => value.trim().length > 0);

  return Array.from(new Set(attempts));
}
