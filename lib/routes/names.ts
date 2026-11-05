export interface NamedRoute {
  id: string;
  name: string;
}

export function normalizeRouteName(name: string) {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isUniqueRouteName(name: string, routes: readonly NamedRoute[], excludingId?: string) {
  const normalized = normalizeRouteName(name);
  return Boolean(normalized) && !routes.some((route) => (
    route.id !== excludingId && normalizeRouteName(route.name) === normalized
  ));
}

export function nextUniqueRouteName(baseName: string, routes: readonly NamedRoute[]) {
  const base = `${baseName.trim() || "Untitled route"} copy`.slice(0, 120);
  if (isUniqueRouteName(base, routes)) return base;

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const suffixText = ` ${suffix}`;
    const candidate = `${base.slice(0, 120 - suffixText.length)}${suffixText}`;
    if (isUniqueRouteName(candidate, routes)) return candidate;
  }

  throw new Error("Unable to create a unique route name.");
}
