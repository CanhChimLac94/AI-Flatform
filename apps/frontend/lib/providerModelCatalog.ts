import { listModelCatalog } from "./api";
import { loadGuestSettings } from "./guestSettings";
import { getProviderVisual } from "./providerVisuals";
import type { ProviderModelEntry, ProviderModelGroup } from "./types";

export { GUEST_SETTINGS_UPDATED_EVENT } from "./guestSettings";

export function isConfiguredApiKey(key: string | undefined | null): boolean {
  const k = (key ?? "").trim();
  return k.length > 8 && k !== "sk-...";
}

export function configuredGuestProviders(): Set<string> {
  const { apiKeys } = loadGuestSettings();
  return new Set(
    Object.entries(apiKeys)
      .filter(([, key]) => isConfiguredApiKey(key))
      .map(([provider]) => provider),
  );
}

export function filterCatalogByConfiguredProviders(
  groups: ProviderModelGroup[],
  providers: Set<string>,
): ProviderModelGroup[] {
  return groups.filter((g) => providers.has(g.provider));
}

export function displayModelLabel(entry: ProviderModelEntry): string {
  return entry.display_name?.trim() || entry.model_id;
}

export function filterEnabledCatalogGroups(groups: ProviderModelGroup[]): ProviderModelGroup[] {
  return groups
    .map((g) => ({
      ...g,
      models: [...g.models]
        .filter((m) => m.is_enabled)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((g) => g.models.length > 0);
}

/** Load enabled model catalog from DB (same source for guest and authenticated users). */
export async function loadModelCatalog(_isAuthenticated?: boolean): Promise<ProviderModelGroup[]> {
  const groups = await listModelCatalog();
  return filterEnabledCatalogGroups(groups);
}

/** Model catalog for chat — only providers with a configured API key (guest) or keys (auth). */
export async function loadChatModelCatalog(isAuthenticated: boolean): Promise<ProviderModelGroup[]> {
  if (!isAuthenticated) {
    const configured = configuredGuestProviders();
    const groups = await loadModelCatalog(false);
    return filterCatalogByConfiguredProviders(groups, configured);
  }
  const groups = await listModelCatalog({ requireKeys: true });
  return filterEnabledCatalogGroups(groups);
}

export function groupDisplayName(group: ProviderModelGroup): string {
  return getProviderVisual(group.provider, group.provider_name).name;
}

export function resolveProviderForModel(
  groups: ProviderModelGroup[],
  modelId: string,
  hintProvider?: string,
): string | undefined {
  if (hintProvider) {
    const group = groups.find((g) => g.provider === hintProvider);
    if (group?.models.some((m) => m.model_id === modelId)) return hintProvider;
  }
  for (const g of groups) {
    if (g.models.some((m) => m.model_id === modelId)) return g.provider;
  }
  return undefined;
}

export function catalogOptionValue(provider: string, modelId: string): string {
  return `${provider}::${modelId}`;
}

export function parseCatalogOptionValue(
  value: string,
): { provider: string; modelId: string } | null {
  const idx = value.indexOf("::");
  if (idx <= 0) return null;
  return { provider: value.slice(0, idx), modelId: value.slice(idx + 2) };
}

export function catalogSelectValue(
  groups: ProviderModelGroup[],
  modelId: string,
  providerHint?: string,
): string {
  if (!modelId) return "";
  const provider = resolveProviderForModel(groups, modelId, providerHint);
  if (provider) return catalogOptionValue(provider, modelId);
  return modelId;
}
