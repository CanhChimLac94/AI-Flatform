/**
 * Guest model catalog — reads from server DB catalog (public /settings/models/catalog).
 */

import { fetchProviderModels } from "./api";

/** Enabled model IDs for a provider (from DB catalog). */
export async function guestEnabledModelIds(provider: string): Promise<string[]> {
  try {
    return await fetchProviderModels(provider);
  } catch {
    return [];
  }
}
