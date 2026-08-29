import { NextResponse } from "next/server";

import type { WeatherLocationSearchResult } from "@/lib/weather-location-types";

const GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search";

interface OpenMeteoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  country: string;
  admin1?: string;
}

interface OpenMeteoSearchResponse {
  results?: OpenMeteoLocation[];
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const parameters = new URLSearchParams({
      name: query,
      count: "8",
      language: "en",
      format: "json",
      countryCode: "US",
    });
    const response = await fetch(`${GEOCODING_API_URL}?${parameters}`, {
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed with ${response.status}.`);
    }

    const data = (await response.json()) as OpenMeteoSearchResponse;
    const results: WeatherLocationSearchResult[] = (data.results ?? []).map(
      (location) => ({
        provider: "open-meteo",
        providerLocationId: location.id,
        name: location.name,
        region: location.admin1 ?? null,
        country: location.country,
        countryCode: location.country_code,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Location search failed:", error);

    return NextResponse.json(
      { error: "Unable to search for locations." },
      { status: 502 },
    );
  }
}
