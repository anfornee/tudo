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
  writeBatch,
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

  const locations = snapshot.docs.map((locationDocument) => {
    const data = locationDocument.data() as Omit<
      SavedWeatherLocation,
      "id"
    >;

    return {
      id: locationDocument.id,
      ...data,
      sortOrder: Number.isFinite(data.sortOrder) ? data.sortOrder : null,
    };
  });

  return locations.sort((first, second) => {
    const orderDifference =
      (first.sortOrder ?? Number.POSITIVE_INFINITY) -
      (second.sortOrder ?? Number.POSITIVE_INFINITY);

    if (orderDifference !== 0) return orderDifference;
    return (first.createdAt?.toMillis() ?? 0) - (second.createdAt?.toMillis() ?? 0);
  });
}

export async function addSavedWeatherLocation(
  userId: string,
  location: WeatherLocationSearchResult,
  sortOrder: number,
): Promise<SavedWeatherLocation> {
  const id = locationDocumentId(location);
  const locationDocument = doc(weatherLocationsCollection(userId), id);

  if ((await getDoc(locationDocument)).exists()) {
    throw new Error("That location is already saved.");
  }

  const savedLocation = {
    ...location,
    sortOrder,
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

export async function saveWeatherLocationOrder(
  userId: string,
  locationIds: readonly string[],
): Promise<void> {
  const batch = writeBatch(db);

  locationIds.forEach((locationId, sortOrder) => {
    batch.update(doc(weatherLocationsCollection(userId), locationId), {
      sortOrder,
    });
  });

  await batch.commit();
}
