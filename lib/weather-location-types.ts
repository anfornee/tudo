import type { Timestamp } from "firebase/firestore";

export interface WeatherLocationSearchResult {
  provider: "open-meteo";
  providerLocationId: number;
  name: string;
  region: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

export interface SavedWeatherLocation extends WeatherLocationSearchResult {
  id: string;
  createdAt: Timestamp | null;
  sortOrder: number | null;
}
