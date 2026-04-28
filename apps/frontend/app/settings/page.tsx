"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  UserCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import {
  getApiKeys, addApiKey, updateApiKey, deleteApiKey, activateApiKey,
  revealApiKey, getMe, patchMe,
  getUserSettings, patchUserSettings, testProviderKey, fetchProviderModels,
  type ProviderKeyGroup, type StoredKeyInfo,
} from "@/lib/api";
import { PROVIDERS, PROVIDER_KEY_URLS } from "@/lib/types";
import type { ProviderConfig, PersonaConfig, UserSettings } from "@/lib/types";
import {
  loadGuestSettings,
  updateGuestApiKey,
  removeGuestApiKey,
  setPreferredProvider,
  setPreferredModel,
} from "@/lib/guestSettings";
import {
  loadLocalPersona,
  saveLocalPersona,
  EMPTY_PERSONA,
} from "@/lib/personaSync";

const TONE_OPTIONS = ["helpful", "formal", "casual", "concise", "creative"];

// ── Persona editor ────────────────────────────────────────────────────────────

function PersonaEditor({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [cfg, setCfg] = useState<PersonaConfig>(EMPTY_PERSONA);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      getMe()
        .then((u) => setCfg((u.persona_config as PersonaConfig) ?? EMPTY_PERSONA))
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
          <label className="block text-xs text-gray-400 mb-1.5">System persona</label>
          <textarea
            value={cfg.persona}
            onChange={(e) => setCfg((c) => ({ ...c, persona: e.target.value }))}
            placeholder="e.g. You are a senior Python engineer who gives concise code-focused answers."
            rows={3}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Preferred language</label>
            <input
              type="text"
              value={cfg.language}
              onChange={(e) => setCfg((c) => ({ ...c, language: e.target.value }))}
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
                <option key={t} value={t}>{t}</option>
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

// ── Single stored key row ─────────────────────────────────────────────────────

function StoredKeyRow({
  keyInfo,
  provider,
  onActivate,
  onDelete,
  onReveal,
}: {
  keyInfo: StoredKeyInfo;
  provider: string;
  onActivate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReveal: (id: string) => Promise<string>;
}) {
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try { await onActivate(keyInfo.id); } finally { setActivating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(keyInfo.id); } finally { setDeleting(false); }
  };

  const handleCopy = async () => {
    try {
      const plain = await onReveal(keyInfo.id);
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
      keyInfo.is_active
        ? "border-blue-500/40 bg-blue-500/5"
        : "border-gray-700 bg-gray-900/50"
    }`}>
      {/* Active indicator */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${keyInfo.is_active ? "bg-blue-400" : "bg-gray-600"}`} />

      {/* Label + masked key */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{keyInfo.label}</span>
          {keyInfo.is_active && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex-shrink-0">
              <BoltIcon className="w-3 h-3" />
              Active
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-gray-500">{keyInfo.masked_key}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded"
          title="Copy key"
        >
          {copied
            ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
            : <ClipboardDocumentIcon className="w-4 h-4" />}
        </button>

        {!keyInfo.is_active && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400 rounded transition-colors disabled:opacity-40"
            title="Set as active"
          >
            {activating ? "…" : "Use"}
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded disabled:opacity-40"
          title="Delete key"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Add-key inline form ───────────────────────────────────────────────────────

type TestState = "idle" | "testing" | "ok" | "fail";

function AddKeyForm({
  provider,
  placeholder,
  onAdd,
  onCancel,
}: {
  provider: string;
  placeholder: string;
  onAdd: (apiKey: string, label: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTestState("testing");
    setTestMsg(null);
    try {
      const res = await testProviderKey(provider, apiKey.trim());
      setTestState(res.ok ? "ok" : "fail");
      setTestMsg(res.message);
    } catch (e: unknown) {
      setTestState("fail");
      setTestMsg(e instanceof Error ? e.message : "Test failed");
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(apiKey.trim(), label.trim() || "Default");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-gray-600 bg-gray-900 space-y-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder='Label (e.g. "Personal", "Work")'
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTestState("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={placeholder}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            tabIndex={-1}
          >
            {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>

        {apiKey.trim() && (
          <button
            onClick={handleTest}
            disabled={testState === "testing"}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
              testState === "ok"
                ? "border-green-600 text-green-400 bg-green-900/20"
                : testState === "fail"
                ? "border-red-600 text-red-400 bg-red-900/20"
                : "border-gray-600 text-gray-400 hover:border-gray-400"
            }`}
          >
            {testState === "testing" ? "Testing…" : testState === "ok" ? "✓" : testState === "fail" ? "✗" : "Test"}
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
      {testMsg && (
        <p className={`text-xs ${testState === "ok" ? "text-green-400" : "text-red-400"}`}>{testMsg}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Authenticated: server-side provider card ──────────────────────────────────

function ServerApiKeyCard({
  group,
  onUpdated,
}: {
  group: ProviderKeyGroup;
  onUpdated: () => void;
}) {
  const provider = PROVIDERS.find((p) => p.id === group.provider);
  const placeholder = provider?.placeholder ?? "API key…";
  const keyPageUrl = PROVIDER_KEY_URLS[group.provider];

  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = async (apiKey: string, label: string) => {
    await addApiKey(group.provider, apiKey, label, true);
    setShowAddForm(false);
    onUpdated();
  };

  const handleActivate = async (keyId: string) => {
    await activateApiKey(group.provider, keyId);
    onUpdated();
  };

  const handleDelete = async (keyId: string) => {
    await deleteApiKey(group.provider, keyId);
    onUpdated();
  };

  const handleReveal = async (keyId: string): Promise<string> => {
    return revealApiKey(group.provider, keyId);
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{group.name}</span>
          {group.is_set ? (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              group.using_system_key
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                : "bg-green-500/15 text-green-400 border border-green-500/30"
            }`}>
              <CheckCircleIcon className="w-3 h-3" />
              {group.using_system_key ? "System key" : `${group.keys.length} key${group.keys.length !== 1 ? "s" : ""}`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600">
              <XCircleIcon className="w-3 h-3" />
              Not set
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick link to provider API key page */}
          {keyPageUrl && (
            <a
              href={keyPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-blue-300 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-colors"
              title={`Get ${group.name} API key`}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              Get key
            </a>
          )}

          {/* Add new key button */}
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Add key
            </button>
          )}
        </div>
      </div>

      {/* Stored keys list */}
      {group.keys.length > 0 && (
        <div className="space-y-2">
          {group.keys.map((k) => (
            <StoredKeyRow
              key={k.id}
              keyInfo={k}
              provider={group.provider}
              onActivate={handleActivate}
              onDelete={handleDelete}
              onReveal={handleReveal}
            />
          ))}
        </div>
      )}

      {/* Inline add form */}
      {showAddForm && (
        <AddKeyForm
          provider={group.provider}
          placeholder={placeholder}
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}
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
        const models = await fetchProviderModels(s.default_provider).catch(() => []);
        setProviderModels(models);
      })
      .catch(() => {});
  }, []);

  const handleProviderChange = async (provider: string) => {
    if (!settings) return;
    setSettings((s) => s ? { ...s, default_provider: provider } : s);
    try {
      const models = await fetchProviderModels(provider);
      setProviderModels(models);
      const newModel = models[0] ?? "";
      setSettings((s) => s ? { ...s, default_model: newModel } : s);
    } catch { /* keep existing models */ }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await patchUserSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* not critical */ }
    finally { setSaving(false); }
  };

  if (!settings) {
    return <div className="h-28 rounded-xl bg-gray-800/50 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">Default provider &amp; model</h2>
      <p className="text-xs text-gray-400">
        Used when no explicit provider is selected. Stored server-side and synced across devices.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
          <select
            value={settings.default_provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Model</label>
          <select
            value={settings.default_model}
            onChange={(e) => setSettings((s) => s ? { ...s, default_model: e.target.value } : s)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {providerModels.map((m) => (
              <option key={m} value={m}>{m}</option>
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

// ── Guest: localStorage key card ─────────────────────────────────────────────

function GuestApiKeyCard({
  provider,
  savedKey,
  onUpdated,
}: {
  provider: ProviderConfig;
  savedKey: string;
  onUpdated: () => void;
}) {
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedSaved, setCopiedSaved] = useState(false);
  const [copiedInput, setCopiedInput] = useState(false);
  const keyPageUrl = PROVIDER_KEY_URLS[provider.id];

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    updateGuestApiKey(provider.id, trimmed);
    setInputKey("");
    onUpdated();
  };

  const handleCopySaved = () => {
    navigator.clipboard.writeText(savedKey);
    setCopiedSaved(true);
    setTimeout(() => setCopiedSaved(false), 2000);
  };

  const handleCopyInput = () => {
    if (!inputKey.trim()) return;
    navigator.clipboard.writeText(inputKey.trim());
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 2000);
  };

  const maskedSaved = savedKey
    ? savedKey.slice(0, 4) + "••••••••" + savedKey.slice(-4)
    : null;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{provider.name}</span>
          {savedKey ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-400 border border-green-500/30">
              <CheckCircleIcon className="w-3 h-3" />
              Local key set
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600">
              <XCircleIcon className="w-3 h-3" />
              Not set
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {maskedSaved && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">{maskedSaved}</span>
              <button
                type="button"
                onClick={handleCopySaved}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Copy saved key"
              >
                {copiedSaved
                  ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
                  : <ClipboardDocumentIcon className="w-4 h-4" />}
              </button>
            </div>
          )}
          {keyPageUrl && (
            <a
              href={keyPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-blue-300 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-colors"
              title={`Get ${provider.name} API key`}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              Get key
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={inputKey}
            onChange={(e) => { setInputKey(e.target.value); setCopiedInput(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={provider.placeholder}
            className={`w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${inputKey.trim() ? "pr-16" : "pr-9"}`}
          />
          {inputKey.trim() && (
            <button
              type="button"
              onClick={handleCopyInput}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              tabIndex={-1}
              title="Copy key"
            >
              {copiedInput
                ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
                : <ClipboardDocumentIcon className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            tabIndex={-1}
          >
            {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!inputKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Save
        </button>
        {savedKey && (
          <button
            onClick={() => { removeGuestApiKey(provider.id); onUpdated(); }}
            className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-red-600/80 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            Remove
          </button>
        )}
      </div>
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
  const currentProvider = PROVIDERS.find((p) => p.id === preferredProvider) ?? PROVIDERS[0];
  const currentModel = preferredModelByProvider[preferredProvider] ?? currentProvider.defaultModel;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">Default provider &amp; model</h2>
      <p className="text-xs text-gray-400">Used automatically when starting a new chat.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
          <select
            value={preferredProvider}
            onChange={(e) => { setPreferredProvider(e.target.value); onChange(); }}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Model</label>
          <select
            value={currentModel}
            onChange={(e) => { setPreferredModel(preferredProvider, e.target.value); onChange(); }}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {currentProvider.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();

  const [serverGroups, setServerGroups] = useState<ProviderKeyGroup[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const reloadServerKeys = useCallback(async () => {
    setLoadingServer(true);
    setServerError(null);
    try {
      setServerGroups(await getApiKeys());
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) reloadServerKeys();
  }, [isAuthenticated, reloadServerKeys]);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const guestSettings = loadGuestSettings();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to chat
        </Link>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <KeyIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          {!isAuthenticated && (
            <p className="text-sm text-gray-400">
              Settings are stored locally in your browser.{" "}
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 underline">
                Log in
              </Link>{" "}
              to save them securely on the server and sync across devices.
            </p>
          )}
        </div>

        <PersonaEditor isAuthenticated={isAuthenticated} />

        {isAuthenticated ? (
          <AuthPreferenceSection />
        ) : (
          <PreferenceSection
            preferredProvider={guestSettings.preferredProvider}
            preferredModelByProvider={guestSettings.preferredModelByProvider}
            onChange={refresh}
          />
        )}

        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-4">API Keys</h2>
          {isAuthenticated ? (
            loadingServer ? (
              <div className="space-y-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-gray-800/50 animate-pulse" />
                ))}
              </div>
            ) : serverError ? (
              <p className="text-red-400 text-sm">{serverError}</p>
            ) : (
              <div className="space-y-4">
                {[...serverGroups]
                  .sort((a, b) => {
                    const ai = PROVIDERS.findIndex((p) => p.id === a.provider);
                    const bi = PROVIDERS.findIndex((p) => p.id === b.provider);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                  })
                  .map((g) => (
                    <ServerApiKeyCard key={g.provider} group={g} onUpdated={reloadServerKeys} />
                  ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {PROVIDERS.map((p) => (
                <GuestApiKeyCard
                  key={p.id}
                  provider={p}
                  savedKey={guestSettings.apiKeys[p.id] ?? ""}
                  onUpdated={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
