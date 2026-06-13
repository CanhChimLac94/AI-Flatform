/**
 * Guest provider model catalog — localStorage-backed.
 */

import type { GuestSettings, ProviderModelEntry } from "./types";
import { PROVIDERS } from "./types";
import { loadGuestSettings, saveGuestSettings } from "./guestSettings";

function newId(): string {
  return crypto.randomUUID();
}

function seedProviderModels(provider: string): ProviderModelEntry[] {
  const cfg = PROVIDERS.find((p) => p.id === provider);
  if (!cfg) return [];
  return cfg.models.map((model_id, idx) => ({
    id: newId(),
    provider,
    model_id,
    display_name: null,
    is_enabled: true,
    is_builtin: true,
    sort_order: idx,
  }));
}

export function getGuestProviderModelGroups(): { provider: string; provider_name: string; models: ProviderModelEntry[] }[] {
  const s = loadGuestSettings();
  return PROVIDERS.map((p) => ({
    provider: p.id,
    provider_name: p.name,
    models: s.providerModels[p.id]?.length
      ? [...s.providerModels[p.id]].sort((a, b) => a.sort_order - b.sort_order)
      : seedProviderModels(p.id),
  }));
}

export function ensureGuestProviderModelsSaved(): void {
  const s = loadGuestSettings();
  let dirty = false;
  for (const p of PROVIDERS) {
    if (!s.providerModels[p.id]?.length) {
      s.providerModels[p.id] = seedProviderModels(p.id);
      dirty = true;
    }
  }
  if (dirty) saveGuestSettings(s);
}

export function guestCreateProviderModel(
  provider: string,
  model_id: string,
  display_name?: string | null,
): ProviderModelEntry {
  const s = loadGuestSettings();
  ensureGuestProviderModelsSaved();
  const rows = s.providerModels[provider] ?? seedProviderModels(provider);
  if (rows.some((r) => r.model_id === model_id)) {
    throw new Error("Model already exists for this provider");
  }
  const entry: ProviderModelEntry = {
    id: newId(),
    provider,
    model_id,
    display_name: display_name ?? null,
    is_enabled: true,
    is_builtin: false,
    sort_order: rows.length,
  };
  s.providerModels[provider] = [...rows, entry];
  saveGuestSettings(s);
  return entry;
}

export function guestUpdateProviderModel(
  provider: string,
  entryId: string,
  patch: { model_id?: string; display_name?: string | null; is_enabled?: boolean },
): ProviderModelEntry {
  const s = loadGuestSettings();
  const rows = s.providerModels[provider] ?? [];
  const idx = rows.findIndex((r) => r.id === entryId);
  if (idx === -1) throw new Error("Model entry not found");
  const row = rows[idx];
  if (patch.model_id !== undefined) {
    if (row.is_builtin) throw new Error("Cannot change model_id of a built-in entry");
    if (rows.some((r) => r.id !== entryId && r.model_id === patch.model_id)) {
      throw new Error("Model already exists for this provider");
    }
    row.model_id = patch.model_id;
  }
  if (patch.display_name !== undefined) row.display_name = patch.display_name;
  if (patch.is_enabled !== undefined) row.is_enabled = patch.is_enabled;
  rows[idx] = row;
  s.providerModels[provider] = [...rows];
  saveGuestSettings(s);
  return row;
}

export function guestDeleteProviderModel(provider: string, entryId: string): void {
  const s = loadGuestSettings();
  const rows = s.providerModels[provider] ?? [];
  const row = rows.find((r) => r.id === entryId);
  if (!row) throw new Error("Model entry not found");
  if (row.is_builtin) throw new Error("Built-in models cannot be deleted; disable them instead");
  s.providerModels[provider] = rows.filter((r) => r.id !== entryId);
  saveGuestSettings(s);
}

/** Enabled model IDs for a provider (guest). */
export function guestEnabledModelIds(provider: string): string[] {
  const s = loadGuestSettings();
  const rows = s.providerModels[provider]?.length
    ? s.providerModels[provider]
    : seedProviderModels(provider);
  return rows.filter((r) => r.is_enabled).map((r) => r.model_id);
}
