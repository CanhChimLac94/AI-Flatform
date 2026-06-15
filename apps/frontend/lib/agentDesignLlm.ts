import type { ProviderModelGroup } from "./types";

/** Providers supported by POST /agents/design-chat (OpenAI-compatible APIs). */
export const AGENT_DESIGN_SUPPORTED_PROVIDERS = new Set([
  "groq",
  "openrouter",
  "nvidia",
  "openai",
]);

export function filterDesignCatalogGroups(groups: ProviderModelGroup[]): ProviderModelGroup[] {
  return groups.filter((g) => AGENT_DESIGN_SUPPORTED_PROVIDERS.has(g.provider));
}

export function pickDesignModelForProvider(
  groups: ProviderModelGroup[],
  provider: string,
  preferredModel?: string,
): string {
  const group = groups.find((g) => g.provider === provider);
  if (!group?.models.length) return preferredModel ?? "";
  if (preferredModel && group.models.some((m) => m.model_id === preferredModel)) {
    return preferredModel;
  }
  return group.models[0].model_id;
}
