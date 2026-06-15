/**
 * Guest settings — preferences in localStorage, API keys in sessionStorage only.
 *
 * Preferences (provider/model/persona prefs) persist in localStorage.
 * API keys live in sessionStorage and are cleared when the tab/window closes
 * or the page is reloaded — guests must re-enter keys each session.
 */

import type { GuestSettings } from "./types";
import { PROVIDERS } from "./types";

const PERSISTENT_KEY = "aichat.settings.guest";
const SESSION_API_KEYS_KEY = "aichat.guest.apiKeys";

export const GUEST_SETTINGS_UPDATED_EVENT = "aichat:guest_settings_updated";

const DEFAULT_PREFS: Omit<GuestSettings, "apiKeys"> = {
  preferredProvider: "openai",
  preferredModelByProvider: {},
  providerModels: {},
};

function notifyGuestSettingsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GUEST_SETTINGS_UPDATED_EVENT));
}

function loadSessionApiKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_API_KEYS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveSessionApiKeys(apiKeys: Record<string, string>): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_API_KEYS_KEY, JSON.stringify(apiKeys));
  notifyGuestSettingsUpdated();
}

function loadPersistentPrefs(): Omit<GuestSettings, "apiKeys"> {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(PERSISTENT_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<GuestSettings>;
    // Drop legacy apiKeys from localStorage blob if still present.
    if ("apiKeys" in parsed) {
      const { apiKeys: _removed, ...rest } = parsed;
      localStorage.setItem(PERSISTENT_KEY, JSON.stringify(rest));
    }
    return {
      preferredProvider: parsed.preferredProvider ?? DEFAULT_PREFS.preferredProvider,
      preferredModelByProvider: parsed.preferredModelByProvider ?? {},
      providerModels: parsed.providerModels ?? {},
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePersistentPrefs(prefs: Omit<GuestSettings, "apiKeys">): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSISTENT_KEY, JSON.stringify(prefs));
}

export function loadGuestSettings(): GuestSettings {
  return {
    ...loadPersistentPrefs(),
    apiKeys: loadSessionApiKeys(),
  };
}

export function saveGuestSettings(s: GuestSettings): void {
  const { apiKeys, ...prefs } = s;
  savePersistentPrefs(prefs);
  saveSessionApiKeys(apiKeys);
}

export function updateGuestApiKey(provider: string, key: string): void {
  const apiKeys = loadSessionApiKeys();
  apiKeys[provider] = key;
  saveSessionApiKeys(apiKeys);
}

export function removeGuestApiKey(provider: string): void {
  const apiKeys = loadSessionApiKeys();
  delete apiKeys[provider];
  saveSessionApiKeys(apiKeys);
}

export function setPreferredProvider(provider: string): void {
  const prefs = loadPersistentPrefs();
  prefs.preferredProvider = provider;
  savePersistentPrefs(prefs);
  notifyGuestSettingsUpdated();
}

export function setPreferredModel(provider: string, model: string): void {
  const prefs = loadPersistentPrefs();
  prefs.preferredModelByProvider[provider] = model;
  savePersistentPrefs(prefs);
  notifyGuestSettingsUpdated();
}

/** Resolve the active model for a provider, falling back to the provider's defaultModel. */
export function resolveModel(settings: GuestSettings, provider: string): string {
  const explicit = settings.preferredModelByProvider[provider];
  if (explicit) return explicit;
  const cfg = PROVIDERS.find((p) => p.id === provider);
  return cfg?.defaultModel ?? "";
}
