type AddressInput = {
  street?: string;
  number?: string;
  neighborhood?: string;
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

const DEFAULT_CITY = "Benevides";
const DEFAULT_STATE = "PA";
const DEFAULT_COUNTRY = "Brasil";
const neighborhoodFallbacks: Record<string, { latitude: number; longitude: number }> = {
  centro: { latitude: -1.3619, longitude: -48.2447 },
  murinin: { latitude: -1.2826, longitude: -48.3142 },
  "santa maria": { latitude: -1.3402, longitude: -48.2708 },
  maguari: { latitude: -1.3923, longitude: -48.2321 },
  benfica: { latitude: -1.4172, longitude: -48.2036 },
  "parque verde": { latitude: -1.3553, longitude: -48.2291 }
};

export function buildFullAddress(address: AddressInput) {
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.neighborhood,
    address.community,
    address.city || DEFAULT_CITY,
    address.state || DEFAULT_STATE,
    address.country || DEFAULT_COUNTRY,
    address.zipCode
  ]
    .filter(Boolean)
    .join(", ");
}

export async function geocodeAddress(address: AddressInput): Promise<GeocodeResult | null> {
  const fullAddress = buildFullAddress(address);
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
    provider: "openstreetmap-nominatim"
  };
}

export async function enrichUserAddress<T extends Record<string, any>>(payload: T): Promise<T> {
  const address = normalizeAddress(payload);
  if (!hasAddress(address)) return payload;
  const next = { city: DEFAULT_CITY, state: DEFAULT_STATE, country: DEFAULT_COUNTRY, ...payload };

  try {
    const result = await geocodeAddress(address);
    if (!result) return withFallbackCoordinates(next, address);
    return {
      ...next,
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
      geocodedAt: new Date(),
      geocodingProvider: result.provider,
      geocodingStatus: "success",
      geocodingConfidence: result.confidence
    };
  } catch {
    return withFallbackCoordinates(next, address);
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
      const fallback = fallbackCoordinates(address);
      return {
        ...payload,
        location: fallback ? { lat: fallback.latitude, lng: fallback.longitude, source: "address" } : { ...(payload.location ?? {}), source: "address" },
        address: { ...payload.address, ...address, geocodingStatus: "failed", geocodingProvider: fallback ? "neighborhood-fallback" : "openstreetmap-nominatim", geocodingConfidence: fallback ? 0.25 : undefined }
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
    const fallback = fallbackCoordinates(address);
    return {
      ...payload,
      location: fallback ? { lat: fallback.latitude, lng: fallback.longitude, source: "address" } : { ...(payload.location ?? {}), source: "address" },
      address: { ...payload.address, ...address, geocodingStatus: "failed", geocodingProvider: fallback ? "neighborhood-fallback" : "openstreetmap-nominatim", geocodingConfidence: fallback ? 0.25 : undefined }
    };
  }
}

function normalizeAddress(payload: Record<string, any>): AddressInput {
  return {
    street: payload.street,
    number: payload.number,
    neighborhood: payload.neighborhood,
    community: payload.community,
    city: payload.city || DEFAULT_CITY,
    state: payload.state || DEFAULT_STATE,
    country: payload.country || DEFAULT_COUNTRY,
    zipCode: payload.zipCode
  };
}

function hasAddress(address: AddressInput) {
  return Boolean(address.street || address.neighborhood || address.community || address.zipCode);
}

function withFallbackCoordinates<T extends Record<string, any>>(payload: T, address: AddressInput): T {
  const fallback = fallbackCoordinates(address);
  if (!fallback) return { ...payload, geocodingStatus: "failed", geocodingProvider: "openstreetmap-nominatim" };
  return {
    ...payload,
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    formattedAddress: buildFullAddress(address),
    geocodedAt: new Date(),
    geocodingProvider: "neighborhood-fallback",
    geocodingStatus: "failed",
    geocodingConfidence: 0.25
  };
}

function fallbackCoordinates(address: AddressInput) {
  const key = (address.neighborhood || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return neighborhoodFallbacks[key] ?? null;
}
