"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  KeyIcon,
  UserCircleIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import {
  getApiKeys,
  getMe,
  patchMe,
  getUserSettings,
  patchUserSettings,
  fetchProviderModels,
  type ProviderKeyGroup,
} from "@/lib/api";
import { PROVIDERS } from "@/lib/types";
import type { PersonaConfig, UserSettings } from "@/lib/types";
import {
  loadGuestSettings,
  setPreferredProvider,
  setPreferredModel,
  GUEST_SETTINGS_UPDATED_EVENT,
} from "@/lib/guestSettings";
import {
  loadLocalPersona,
  saveLocalPersona,
  EMPTY_PERSONA,
} from "@/lib/personaSync";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import { ProviderModelsSection } from "@/components/settings/ProviderModelsSection";
import { useI18n } from "@/contexts/I18nContext";

const TONE_OPTIONS = ["helpful", "formal", "casual", "concise", "creative"];

type SettingsTab = "persona" | "models" | "api-keys";

const SETTINGS_TABS: {
  id: SettingsTab;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "persona", labelKey: "settings.tabs.persona", icon: UserCircleIcon },
  { id: "models", labelKey: "settings.tabs.models", icon: CpuChipIcon },
  { id: "api-keys", labelKey: "settings.tabs.apiKeys", icon: KeyIcon },
];

// ── Persona editor ────────────────────────────────────────────────────────────

function PersonaEditor({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [cfg, setCfg] = useState<PersonaConfig>(EMPTY_PERSONA);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      getMe()
        .then((u) =>
          setCfg((u.persona_config as PersonaConfig) ?? EMPTY_PERSONA),
        )
        .catch(() => {});
    } else {
      setCfg(loadLocalPersona() ?? EMPTY_PERSONA);
    }
  }, [isAuthenticated]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isAuthenticated) {
        await patchMe({ persona_config: cfg });
      } else {
        saveLocalPersona(cfg);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <UserCircleIcon className="w-5 h-5 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">Persona</h2>
        {!isAuthenticated && (
          <span className="text-xs text-gray-500">(stored locally)</span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            System persona
          </label>
          <textarea
            value={cfg.persona}
            onChange={(e) => setCfg((c) => ({ ...c, persona: e.target.value }))}
            placeholder="e.g. You are a senior Python engineer who gives concise code-focused answers."
            rows={3}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Preferred language
            </label>
            <input
              type="text"
              value={cfg.language}
              onChange={(e) =>
                setCfg((c) => ({ ...c, language: e.target.value }))
              }
              placeholder="en, vi, fr…"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Tone</label>
            <select
              value={cfg.tone}
              onChange={(e) => setCfg((c) => ({ ...c, tone: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg transition-colors"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save persona"}
      </button>
    </div>
  );
}

// ── Authenticated: default provider/model section ─────────────────────────────

function AuthPreferenceSection() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [providerModels, setProviderModels] = useState<string[]>([]);

  useEffect(() => {
    getUserSettings()
      .then(async (s) => {
        setSettings(s);
        const models = await fetchProviderModels(s.default_provider).catch(
          () => [],
        );
        setProviderModels(models);
      })
      .catch(() => {});
  }, []);

  const handleProviderChange = async (provider: string) => {
    if (!settings) return;
    setSettings((s) => (s ? { ...s, default_provider: provider } : s));
    try {
      const models = await fetchProviderModels(provider);
      setProviderModels(models);
      const newModel = models[0] ?? "";
      setSettings((s) => (s ? { ...s, default_model: newModel } : s));
    } catch {
      /* keep existing models */
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await patchUserSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* not critical */
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="h-28 rounded-xl bg-gray-800/50 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">
        Default provider &amp; model
      </h2>
      <p className="text-xs text-gray-400">
        Used when no explicit provider is selected. Stored server-side and
        synced across devices.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
          <select
            value={settings.default_provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Model</label>
          <select
            value={settings.default_model}
            onChange={(e) =>
              setSettings((s) =>
                s ? { ...s, default_model: e.target.value } : s,
              )
            }
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {providerModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save defaults"}
      </button>
    </div>
  );
}

// ── Preferred provider / model (guest only) ───────────────────────────────────

function PreferenceSection({
  preferredProvider,
  preferredModelByProvider,
  onChange,
}: {
  preferredProvider: string;
  preferredModelByProvider: Record<string, string>;
  onChange: () => void;
}) {
  const currentProvider =
    PROVIDERS.find((p) => p.id === preferredProvider) ?? PROVIDERS[0];
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    fetchProviderModels(preferredProvider)
      .then((ids) => {
        if (!cancelled) setModelOptions(ids);
      })
      .catch(() => {
        if (!cancelled) setModelOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preferredProvider]);

  const currentModel =
    preferredModelByProvider[preferredProvider] ??
    modelOptions[0] ??
    currentProvider.defaultModel;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">
        Default provider &amp; model
      </h2>
      <p className="text-xs text-gray-400">
        Used automatically when starting a new chat.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
          <select
            value={preferredProvider}
            onChange={(e) => {
              setPreferredProvider(e.target.value);
              onChange();
            }}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Model</label>
          <select
            value={currentModel}
            onChange={(e) => {
              setPreferredModel(preferredProvider, e.target.value);
              onChange();
            }}
            disabled={loadingModels}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
          >
            {modelOptions.length === 0 ? (
              <option value={currentModel}>{currentModel}</option>
            ) : (
              modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useI18n();
  const { isAuthenticated, isAdmin, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("persona");

  const [serverGroups, setServerGroups] = useState<ProviderKeyGroup[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const reloadServerKeys = useCallback(async () => {
    setLoadingServer(true);
    setServerError(null);
    try {
      setServerGroups(await getApiKeys());
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : "Failed to load API keys",
      );
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) reloadServerKeys();
  }, [isAuthenticated, reloadServerKeys]);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [guestSettings, setGuestSettings] = useState(loadGuestSettings);

  useEffect(() => {
    if (isAuthenticated) return;
    const sync = () => setGuestSettings(loadGuestSettings());
    sync();
    window.addEventListener(GUEST_SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(GUEST_SETTINGS_UPDATED_EVENT, sync);
  }, [isAuthenticated, tick]);

  return (
    <AppShell>
      <PageHeader icon={KeyIcon} title={t("settings.title")} />

      <div className="shrink-0 border-b border-gray-700 px-4 sm:px-6">
        <div
          role="tablist"
          aria-label={t("settings.tabsAria")}
          className="flex gap-1 -mb-px overflow-x-auto"
        >
          {SETTINGS_TABS.map(({ id, labelKey, icon: TabIcon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? "border-blue-400 text-blue-300"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <TabIcon className="w-4 h-4 shrink-0" />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div
          className={`mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 w-full ${
            activeTab === "models" || activeTab === "api-keys"
              ? "max-w-6xl"
              : "max-w-2xl"
          }`}
        >
          {!isAuthenticated && (
            <p className="text-sm text-gray-400">
              {t("settings.guestBanner")}{" "}
              <Link
                href="/auth/login"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                {t("settings.guestBannerLogin")}
              </Link>{" "}
              {t("settings.guestBannerSuffix")}
              {activeTab === "api-keys" && (
                <>
                  {" "}
                  {t(
                    "settings.apiKeysSection.guestSessionNotice",
                    "API keys are kept only for this browser tab and must be re-entered after reload.",
                  )}
                </>
              )}
            </p>
          )}

          {activeTab === "persona" && (
            <div role="tabpanel" aria-label="Persona" className="space-y-6">
              {isAuthenticated ? (
                <AuthPreferenceSection />
              ) : (
                <PreferenceSection
                  preferredProvider={guestSettings.preferredProvider}
                  preferredModelByProvider={
                    guestSettings.preferredModelByProvider
                  }
                  onChange={refresh}
                />
              )}
              <PersonaEditor isAuthenticated={isAuthenticated} />
            </div>
          )}

          {activeTab === "models" && (
            <div
              role="tabpanel"
              aria-label="Model"
              className="space-y-6 w-full"
            >
              <ProviderModelsSection
                canManage={isAuthenticated && isAdmin}
                isAuthenticated={isAuthenticated}
                isAuthReady={isAuthReady}
                embedded
              />
            </div>
          )}

          {activeTab === "api-keys" && (
            <div role="tabpanel" aria-label="API Keys">
              <ApiKeysSection
                isAuthenticated={isAuthenticated}
                serverGroups={serverGroups}
                loadingServer={loadingServer}
                serverError={serverError}
                onReloadServerKeys={reloadServerKeys}
                guestApiKeys={guestSettings.apiKeys}
                onGuestUpdated={refresh}
              />
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
