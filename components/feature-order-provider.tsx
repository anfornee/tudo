"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  defaultFeatureOrder,
  resolveFeatureOrder,
  type DashboardFeatureId,
  type FeatureId,
} from "@/lib/feature-order";
import { getFeatureOrder, saveFeatureOrder } from "@/lib/feature-preferences";
import { appFeatures } from "@/lib/features";
import { auth } from "@/lib/firebase-client";

interface FeatureOrderContextValue {
  dashboardOrder: DashboardFeatureId[];
  navigationFeatures: Array<(typeof appFeatures)[number]>;
  preferencesLoaded: boolean;
  preferenceError: boolean;
  updateDashboardOrder: (order: DashboardFeatureId[]) => void;
  persistFeatureOrder: () => Promise<void>;
  clearPreferenceError: () => void;
}

const FeatureOrderContext = createContext<FeatureOrderContextValue | null>(null);
const featureById = new Map(appFeatures.map((feature) => [feature.id, feature]));
const dashboardFeatureIds = new Set<FeatureId>(
  appFeatures
    .filter((feature) => feature.showOnDashboard)
    .map((feature) => feature.id),
);

export function FeatureOrderProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [featureOrder, setFeatureOrder] = useState<FeatureId[]>(defaultFeatureOrder);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferenceError, setPreferenceError] = useState(false);
  const featureOrderRef = useRef(featureOrder);

  const updateFeatureOrder = useCallback((order: FeatureId[]) => {
    featureOrderRef.current = order;
    setFeatureOrder(order);
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user || user.uid !== userId) {
          window.location.assign("/api/auth/logout");
          return;
        }

        void getFeatureOrder(userId)
          .then((savedOrder) => updateFeatureOrder(resolveFeatureOrder(savedOrder)))
          .catch((error) => {
            console.error("Unable to load feature preferences:", error);
            updateFeatureOrder([...defaultFeatureOrder]);
            setPreferenceError(true);
          })
          .finally(() => setPreferencesLoaded(true));
      }),
    [updateFeatureOrder, userId],
  );

  const updateDashboardOrder = useCallback(
    (order: DashboardFeatureId[]) => {
      const nonDashboardFeatures = featureOrderRef.current.filter(
        (featureId) => !dashboardFeatureIds.has(featureId),
      );
      updateFeatureOrder([...order, ...nonDashboardFeatures]);
    },
    [updateFeatureOrder],
  );

  const persistFeatureOrder = useCallback(async () => {
    setPreferenceError(false);
    try {
      await saveFeatureOrder(userId, featureOrderRef.current);
    } catch (error) {
      console.error("Unable to save feature order:", error);
      setPreferenceError(true);
    }
  }, [userId]);

  const value = useMemo<FeatureOrderContextValue>(() => {
    const dashboardOrder = featureOrder.filter(
      (featureId): featureId is DashboardFeatureId =>
        dashboardFeatureIds.has(featureId),
    );
    const navigationFeatures = featureOrder
      .map((featureId) => featureById.get(featureId))
      .filter(
        (feature): feature is (typeof appFeatures)[number] =>
          feature !== undefined && feature.showInNav,
      );

    return {
      dashboardOrder,
      navigationFeatures,
      preferencesLoaded,
      preferenceError,
      updateDashboardOrder,
      persistFeatureOrder,
      clearPreferenceError: () => setPreferenceError(false),
    };
  }, [featureOrder, preferenceError, preferencesLoaded, persistFeatureOrder, updateDashboardOrder]);

  return <FeatureOrderContext.Provider value={value}>{children}</FeatureOrderContext.Provider>;
}

export function useFeatureOrder() {
  const value = useContext(FeatureOrderContext);
  if (!value) {
    throw new Error("useFeatureOrder must be used within FeatureOrderProvider.");
  }
  return value;
}
