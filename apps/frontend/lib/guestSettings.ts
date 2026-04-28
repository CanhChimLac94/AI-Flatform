/**
 * GuestSettingsStore — localStorage-backed settings for unauthenticated users.
 *
 * Key: aichat.settings.guest
 * All keys stay 100% local; they are never sent to the backend for storage.
 * When the user logs in, server-side BYOK keys take over automatically
 * (the useChat hook reads isAuthenticated to decide which path to use).
 */

import type { GuestSettings } from "./types";
import { PROVIDERS } from "./types";

const STORAGE_KEY = "aichat.settings.guest";

const DEFAULT_SETTINGS: GuestSettings = {
  apiKeys: {},
  preferredProvider: "openai",
  preferredModelByProvider: {},
};

export function loadGuestSettings(): GuestSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GuestSettings>;
    return {
      apiKeys:                   parsed.apiKeys ?? {},
      preferredProvider:         parsed.preferredProvider ?? DEFAULT_SETTINGS.preferredProvider,
      preferredModelByProvider:  parsed.preferredModelByProvider ?? {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGuestSettings(s: GuestSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function updateGuestApiKey(provider: string, key: string): void {
  const s = loadGuestSettings();
  s.apiKeys[provider] = key;
  saveGuestSettings(s);
}

export function removeGuestApiKey(provider: string): void {
  const s = loadGuestSettings();
  delete s.apiKeys[provider];
  saveGuestSettings(s);
}

export function setPreferredProvider(provider: string): void {
  const s = loadGuestSettings();
  s.preferredProvider = provider;
  saveGuestSettings(s);
}

export function setPreferredModel(provider: string, model: string): void {
  const s = loadGuestSettings();
  s.preferredModelByProvider[provider] = model;
  saveGuestSettings(s);
}

/** Resolve the active model for a provider, falling back to the provider's defaultModel. */
export function resolveModel(settings: GuestSettings, provider: string): string {
  const explicit = settings.preferredModelByProvider[provider];
  if (explicit) return explicit;
  const cfg = PROVIDERS.find((p) => p.id === provider);
  return cfg?.defaultModel ?? "";
}
