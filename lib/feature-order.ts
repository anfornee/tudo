import { appFeatures } from "@/lib/features";

export type FeatureId = (typeof appFeatures)[number]["id"];
type RegisteredFeature = (typeof appFeatures)[number];
export type DashboardFeatureId = Extract<
  RegisteredFeature,
  { readonly showOnDashboard: true }
>["id"];

export const defaultFeatureOrder = appFeatures.map((feature) => feature.id);

export function resolveFeatureOrder(
  savedOrder: readonly unknown[] | null | undefined,
  availableOrder: readonly FeatureId[] = defaultFeatureOrder,
): FeatureId[] {
  const available = new Set<FeatureId>(availableOrder);
  const resolved: FeatureId[] = [];

  for (const value of savedOrder ?? []) {
    if (
      typeof value === "string" &&
      available.has(value as FeatureId) &&
      !resolved.includes(value as FeatureId)
    ) {
      resolved.push(value as FeatureId);
    }
  }

  for (const featureId of availableOrder) {
    if (!resolved.includes(featureId)) {
      resolved.push(featureId);
    }
  }

  return resolved;
}

export function moveFeature<T extends FeatureId>(
  order: readonly T[],
  featureId: T,
  targetIndex: number,
): T[] {
  const currentIndex = order.indexOf(featureId);
  const boundedIndex = Math.max(0, Math.min(order.length - 1, targetIndex));

  if (currentIndex === -1 || currentIndex === boundedIndex) {
    return [...order];
  }

  const nextOrder = [...order];
  nextOrder.splice(currentIndex, 1);
  nextOrder.splice(boundedIndex, 0, featureId);
  return nextOrder;
}
