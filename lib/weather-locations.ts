import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase-client";
import type {
  SavedWeatherLocation,
  WeatherLocationSearchResult,
} from "@/lib/weather-location-types";

function weatherLocationsCollection(userId: string) {
  return collection(db, "users", userId, "weatherLocations");
}

function locationDocumentId(location: WeatherLocationSearchResult) {
  return `${location.provider}-${location.providerLocationId}`;
}

export async function getSavedWeatherLocations(
  userId: string,
): Promise<SavedWeatherLocation[]> {
  const snapshot = await getDocs(
    query(weatherLocationsCollection(userId), orderBy("createdAt", "asc")),
  );

  return snapshot.docs.map((locationDocument) => {
    const data = locationDocument.data() as Omit<
      SavedWeatherLocation,
      "id"
    >;

    return {
      id: locationDocument.id,
      ...data,
    };
  });
}

export async function addSavedWeatherLocation(
  userId: string,
  location: WeatherLocationSearchResult,
): Promise<SavedWeatherLocation> {
  const id = locationDocumentId(location);
  const locationDocument = doc(weatherLocationsCollection(userId), id);

  if ((await getDoc(locationDocument)).exists()) {
    throw new Error("That location is already saved.");
  }

  const savedLocation = {
    ...location,
    createdAt: serverTimestamp(),
  };

  await setDoc(locationDocument, savedLocation);

  const createdDocument = await getDoc(locationDocument);
  const data = createdDocument.data() as Omit<SavedWeatherLocation, "id">;

  return { id, ...data };
}

export async function removeSavedWeatherLocation(
  userId: string,
  locationId: string,
): Promise<void> {
  await deleteDoc(doc(weatherLocationsCollection(userId), locationId));
}
