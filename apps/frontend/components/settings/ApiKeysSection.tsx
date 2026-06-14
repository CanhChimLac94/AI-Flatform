"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  addApiKey,
  activateApiKey,
  deleteApiKey,
  revealApiKey,
  testProviderKey,
  type ProviderKeyGroup,
  type StoredKeyInfo,
} from "@/lib/api";
import { PROVIDERS, PROVIDER_KEY_URLS } from "@/lib/types";
import type { ProviderConfig, ProviderChannelStatus, ProviderKeyStatusCode } from "@/lib/types";
import {
  updateGuestApiKey,
  removeGuestApiKey,
} from "@/lib/guestSettings";
import { guestEnabledModelIds } from "@/lib/guestProviderModels";
import { isConfiguredApiKey } from "@/lib/providerModelCatalog";
import { getProviderVisual } from "@/lib/providerVisuals";
import { useI18n } from "@/contexts/I18nContext";

const GET_KEY_LINK_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-blue-500 border border-border hover:border-blue-500/50 bg-surface-elevated hover:bg-surface-hover rounded-lg transition-colors";

const ADD_KEY_BTN_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground border border-border bg-surface-elevated hover:bg-surface-hover hover:border-accent/50 rounded-lg transition-colors";

function ProviderChannelIcon({
  providerId,
  name,
  size = "md",
}: {
  providerId: string;
  name?: string;
  size?: "sm" | "md";
}) {
  const visual = getProviderVisual(providerId, name);
  const Icon = visual.icon;
  const box = size === "sm" ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl";
  const icon = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <span
      className={`flex items-center justify-center border shrink-0 ${box} ${visual.badgeClass}`}
      aria-hidden
    >
      <Icon className={icon} />
    </span>
  );
}

function ProviderChannelHeading({
  providerId,
  name,
  size = "md",
  className = "",
  id,
}: {
  providerId: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
  id?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <ProviderChannelIcon providerId={providerId} name={name} size={size} />
      <span
        id={id}
        className={`font-medium text-white truncate ${size === "sm" ? "text-sm" : "text-base"}`}
      >
        {name}
      </span>
    </div>
  );
}

function buildGuestChannelStatus(providerId: string, savedKey: string): ProviderChannelStatus {
  const hasStored = Boolean(savedKey?.trim());
  const keyUsable = isConfiguredApiKey(savedKey);
  const enabledCount = guestEnabledModelIds(providerId).length;
  const chatReady = keyUsable && enabledCount > 0;

  let statusCode: ProviderKeyStatusCode = "unavailable";
  if (chatReady) statusCode = "chat_ready";
  else if (!hasStored) statusCode = "no_key";
  else if (!keyUsable) statusCode = "key_not_usable";
  else if (enabledCount === 0) statusCode = "no_enabled_models";

  return {
    chat_ready: chatReady,
    has_stored_keys: hasStored,
    has_active_key: hasStored,
    key_usable: keyUsable,
    enabled_models_count: enabledCount,
    status_code: statusCode,
  };
}

function StatusCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircleIcon className="w-3.5 h-3.5 text-green-400 shrink-0" />
      ) : (
        <XCircleIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
      )}
      <span className={ok ? "text-gray-400" : "text-gray-500"}>{label}</span>
    </li>
  );
}

function ProviderChannelStatusPanel({ status }: { status: ProviderChannelStatus }) {
  const { t } = useI18n();
  const summaryKey = `settings.apiKeysSection.status.${status.status_code}`;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 ${
        status.chat_ready
          ? "border-emerald-800/40 bg-emerald-900/10"
          : "border-amber-800/30 bg-amber-900/5"
      }`}
    >
      <p
        className={`text-xs font-medium ${
          status.chat_ready ? "text-emerald-300" : "text-amber-300/90"
        }`}
      >
        {t(summaryKey, status.status_code)}
      </p>
      <ul className="space-y-1 text-[11px]">
        <StatusCheck
          ok={status.has_stored_keys}
          label={t("settings.apiKeysSection.statusDetail.keyStored", "API key saved")}
        />
        <StatusCheck
          ok={status.has_active_key}
          label={t("settings.apiKeysSection.statusDetail.keyActive", "Active key selected")}
        />
        <StatusCheck
          ok={status.key_usable}
          label={t("settings.apiKeysSection.statusDetail.keyUsable", "Key usable (non-placeholder)")}
        />
        <StatusCheck
          ok={status.enabled_models_count > 0}
          label={t(
            "settings.apiKeysSection.statusDetail.modelsEnabled",
            "{count} model(s) enabled in Settings → Model",
            { count: status.enabled_models_count },
          )}
        />
      </ul>
      {!status.chat_ready && (
        <p className="text-[10px] text-gray-500 leading-relaxed">
          {t(
            "settings.apiKeysSection.chatRequirement",
            "Chat shows a channel only when an active usable key exists and at least one model is enabled.",
          )}
        </p>
      )}
    </div>
  );
}

// ── Stored key row (shown inside modal only) ──────────────────────────────────

function StoredKeyRow({
  keyInfo,
  onActivate,
  onDelete,
  onReveal,
}: {
  keyInfo: StoredKeyInfo;
  onActivate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReveal: (id: string) => Promise<string>;
}) {
  const { t } = useI18n();
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try {
      await onActivate(keyInfo.id);
    } finally {
      setActivating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(keyInfo.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async () => {
    try {
      const plain = await onReveal(keyInfo.id);
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
        keyInfo.is_active
          ? "border-blue-500/40 bg-blue-500/5"
          : "border-gray-700 bg-gray-900/50"
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${keyInfo.is_active ? "bg-blue-400" : "bg-gray-600"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{keyInfo.label}</span>
          {keyInfo.is_active && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
              <BoltIcon className="w-3 h-3" />
              {t("settings.apiKeysSection.active", "Active")}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-gray-500">{keyInfo.masked_key}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded"
          title={t("settings.apiKeysSection.copyKey", "Copy key")}
        >
          {copied ? (
            <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
          ) : (
            <ClipboardDocumentIcon className="w-4 h-4" />
          )}
        </button>
        {!keyInfo.is_active && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400 rounded transition-colors disabled:opacity-40"
            title={t("settings.apiKeysSection.setActive", "Set as active")}
          >
            {activating ? "…" : t("settings.apiKeysSection.use", "Use")}
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded disabled:opacity-40"
          title={t("common.delete", "Delete")}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Add key form (inside modal) ───────────────────────────────────────────────

type TestState = "idle" | "testing" | "ok" | "fail";

function AddKeyForm({
  provider,
  placeholder,
  onAdd,
}: {
  provider: string;
  placeholder: string;
  onAdd: (apiKey: string, label: string) => Promise<void>;
}) {
  const { t } = useI18n();
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
      setTestMsg(e instanceof Error ? e.message : t("settings.apiKeysSection.testFailed", "Test failed"));
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(apiKey.trim(), label.trim() || "Default");
      setApiKey("");
      setLabel("");
      setTestState("idle");
      setTestMsg(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("errors.saveFailed", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {t("settings.apiKeysSection.addNew", "Add new key")}
      </p>
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("settings.apiKeysSection.labelPlaceholder", 'Label (e.g. "Personal", "Work")')}
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestState("idle");
            }}
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
            type="button"
            onClick={handleTest}
            disabled={testState === "testing"}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 shrink-0 ${
              testState === "ok"
                ? "border-green-600 text-green-400 bg-green-900/20"
                : testState === "fail"
                  ? "border-red-600 text-red-400 bg-red-900/20"
                  : "border-gray-600 text-gray-400 hover:border-gray-400"
            }`}
          >
            {testState === "testing"
              ? t("settings.apiKeysSection.testing", "Testing…")
              : testState === "ok"
                ? "✓"
                : testState === "fail"
                  ? "✗"
                  : t("settings.apiKeysSection.test", "Test")}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors shrink-0"
        >
          {saving ? t("settings.apiKeysSection.saving", "Saving…") : t("common.save", "Save")}
        </button>
      </div>
      {testMsg && (
        <p className={`text-xs ${testState === "ok" ? "text-green-400" : "text-red-400"}`}>{testMsg}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Provider keys modal (authenticated) ───────────────────────────────────────

function ProviderKeysModal({
  group,
  placeholder,
  onClose,
  onUpdated,
}: {
  group: ProviderKeyGroup;
  placeholder: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAdd = async (apiKey: string, label: string) => {
    await addApiKey(group.provider, apiKey, label, true);
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

  const handleReveal = async (keyId: string) => revealApiKey(group.provider, keyId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[min(90vh,640px)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-keys-modal-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0 gap-3">
          <ProviderChannelHeading
            providerId={group.provider}
            name={group.name}
            size="sm"
            className="flex-1"
            id="provider-keys-modal-title"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 rounded-lg"
            aria-label={t("common.close", "Close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <ProviderChannelStatusPanel status={group.channel_status} />

          <AddKeyForm provider={group.provider} placeholder={placeholder} onAdd={handleAdd} />

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {t("settings.apiKeysSection.savedKeys", "Saved keys")}
              {group.keys.length > 0 && (
                <span className="text-gray-600 font-normal normal-case ml-1">({group.keys.length})</span>
              )}
            </p>
            {group.keys.length === 0 ? (
              <p className="text-sm text-gray-500 py-3 text-center border border-dashed border-gray-700 rounded-lg">
                {t("settings.apiKeysSection.noKeysYet", "No keys added yet.")}
              </p>
            ) : (
              <div className="space-y-2">
                {group.keys.map((k) => (
                  <StoredKeyRow
                    key={k.id}
                    keyInfo={k}
                    onActivate={handleActivate}
                    onDelete={handleDelete}
                    onReveal={handleReveal}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-700 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            {t("common.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Compact provider card (authenticated) ─────────────────────────────────────

function ServerApiKeyCard({
  group,
  onUpdated,
}: {
  group: ProviderKeyGroup;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const provider = PROVIDERS.find((p) => p.id === group.provider);
  const placeholder = provider?.placeholder ?? "API key…";
  const keyPageUrl = PROVIDER_KEY_URLS[group.provider];
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <ProviderChannelHeading providerId={group.provider} name={group.name} size="sm" className="flex-1" />
          {group.channel_status.chat_ready ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircleIcon className="w-3 h-3" />
              {t("settings.apiKeysSection.status.chat_ready", "Ready for chat")}
            </span>
          ) : group.is_set ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <XCircleIcon className="w-3 h-3" />
              {t(`settings.apiKeysSection.status.${group.channel_status.status_code}`, group.channel_status.status_code)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600 shrink-0">
              <XCircleIcon className="w-3 h-3" />
              {t("settings.apiKeysSection.notSet", "Not set")}
            </span>
          )}
        </div>

        <ProviderChannelStatusPanel status={group.channel_status} />

        <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
          {keyPageUrl && (
            <a
              href={keyPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={GET_KEY_LINK_CLASS}
              title={t("settings.apiKeysSection.getKeyTitle", "Get {name} API key", { name: group.name })}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              {t("settings.apiKeysSection.getKey", "Get key")}
            </a>
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={ADD_KEY_BTN_CLASS}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {t("settings.apiKeysSection.addKey", "Add key")}
          </button>
        </div>
      </div>

      {modalOpen && (
        <ProviderKeysModal
          group={group}
          placeholder={placeholder}
          onClose={() => setModalOpen(false)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}

// ── Guest key modal ─────────────────────────────────────────────────────────────

function GuestKeyModal({
  provider,
  savedKey,
  onClose,
  onUpdated,
}: {
  provider: ProviderConfig;
  savedKey: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedSaved, setCopiedSaved] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maskedSaved = savedKey
    ? savedKey.slice(0, 4) + "••••••••" + savedKey.slice(-4)
    : null;

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    updateGuestApiKey(provider.id, trimmed);
    setInputKey("");
    onUpdated();
    onClose();
  };

  const handleCopySaved = () => {
    navigator.clipboard.writeText(savedKey);
    setCopiedSaved(true);
    setTimeout(() => setCopiedSaved(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 gap-3">
          <ProviderChannelHeading providerId={provider.id} name={provider.name} size="sm" className="flex-1" />
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <ProviderChannelStatusPanel status={buildGuestChannelStatus(provider.id, savedKey)} />

          {savedKey && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t("settings.apiKeysSection.savedKeys", "Saved keys")}
              </p>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/5">
                <CheckCircleIcon className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-xs font-mono text-gray-400 flex-1 truncate">{maskedSaved}</span>
                <button
                  type="button"
                  onClick={handleCopySaved}
                  className="p-1.5 text-gray-500 hover:text-gray-300"
                  title={t("settings.apiKeysSection.copyKey", "Copy key")}
                >
                  {copiedSaved ? (
                    <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeGuestApiKey(provider.id);
                    onUpdated();
                    onClose();
                  }}
                  className="p-1.5 text-gray-600 hover:text-red-400"
                  title={t("common.delete", "Delete")}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {savedKey
                ? t("settings.apiKeysSection.replaceKey", "Replace key")
                : t("settings.apiKeysSection.addNew", "Add new key")}
            </p>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={provider.placeholder}
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
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Compact guest card ──────────────────────────────────────────────────────────

function GuestApiKeyCard({
  provider,
  savedKey,
  onUpdated,
}: {
  provider: ProviderConfig;
  savedKey: string;
  onUpdated: () => void;
}) {
  const { t } = useI18n();
  const keyPageUrl = PROVIDER_KEY_URLS[provider.id];
  const [modalOpen, setModalOpen] = useState(false);
  const channelStatus = buildGuestChannelStatus(provider.id, savedKey);

  return (
    <>
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <ProviderChannelHeading providerId={provider.id} name={provider.name} size="sm" className="flex-1" />
          {channelStatus.chat_ready ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircleIcon className="w-3 h-3" />
              {t("settings.apiKeysSection.status.chat_ready", "Ready for chat")}
            </span>
          ) : savedKey ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <XCircleIcon className="w-3 h-3" />
              {t(`settings.apiKeysSection.status.${channelStatus.status_code}`, channelStatus.status_code)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600 shrink-0">
              <XCircleIcon className="w-3 h-3" />
              {t("settings.apiKeysSection.notSet", "Not set")}
            </span>
          )}
        </div>

        <ProviderChannelStatusPanel status={channelStatus} />

        <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
          {keyPageUrl && (
            <a
              href={keyPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={GET_KEY_LINK_CLASS}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              {t("settings.apiKeysSection.getKey", "Get key")}
            </a>
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={ADD_KEY_BTN_CLASS}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {t("settings.apiKeysSection.addKey", "Add key")}
          </button>
        </div>
      </div>

      {modalOpen && (
        <GuestKeyModal
          provider={provider}
          savedKey={savedKey}
          onClose={() => setModalOpen(false)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}

// ── Section export ──────────────────────────────────────────────────────────────

const PROVIDER_GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";

function sortGroups(groups: ProviderKeyGroup[]): ProviderKeyGroup[] {
  return [...groups].sort((a, b) => {
    const ai = PROVIDERS.findIndex((p) => p.id === a.provider);
    const bi = PROVIDERS.findIndex((p) => p.id === b.provider);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export function ApiKeysSection({
  isAuthenticated,
  serverGroups,
  loadingServer,
  serverError,
  onReloadServerKeys,
  guestApiKeys,
  onGuestUpdated,
}: {
  isAuthenticated: boolean;
  serverGroups: ProviderKeyGroup[];
  loadingServer: boolean;
  serverError: string | null;
  onReloadServerKeys: () => void;
  guestApiKeys: Record<string, string>;
  onGuestUpdated: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        {t(
          "settings.apiKeysSection.intro",
          "Configure API keys per channel. Keys are encrypted when stored on the server.",
        )}
      </p>

      {isAuthenticated ? (
        loadingServer ? (
          <div className={PROVIDER_GRID}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : serverError ? (
          <p className="text-red-400 text-sm">{serverError}</p>
        ) : (
          <div className={PROVIDER_GRID}>
            {sortGroups(serverGroups).map((g) => (
              <ServerApiKeyCard key={g.provider} group={g} onUpdated={onReloadServerKeys} />
            ))}
          </div>
        )
      ) : (
        <div className={PROVIDER_GRID}>
          {PROVIDERS.map((p) => (
            <GuestApiKeyCard
              key={p.id}
              provider={p}
              savedKey={guestApiKeys[p.id] ?? ""}
              onUpdated={onGuestUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
