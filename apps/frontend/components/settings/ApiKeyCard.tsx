"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { ApiKeyStatus } from "@/lib/api";
import { saveApiKey, deleteApiKey } from "@/lib/api";

const PROVIDER_LABELS: Record<string, { name: string; placeholder: string }> = {
  openai:    { name: "OpenAI",    placeholder: "sk-..." },
  anthropic: { name: "Anthropic", placeholder: "sk-ant-..." },
  groq:      { name: "Groq",      placeholder: "gsk_..." },
  google:    { name: "Google",    placeholder: "AIza..." },
};

interface Props {
  status: ApiKeyStatus;
  onUpdated: () => void;
}

export function ApiKeyCard({ status, onUpdated }: Props) {
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = PROVIDER_LABELS[status.provider] ?? { name: status.provider, placeholder: "API key…" };

  const handleSave = async () => {
    if (!inputKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveApiKey(status.provider, inputKey.trim());
      setInputKey("");
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await deleteApiKey(status.provider);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{label.name}</span>
          {status.is_set ? (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              status.using_system_key
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                : "bg-green-500/15 text-green-400 border border-green-500/30"
            }`}>
              <CheckCircleIcon className="w-3 h-3" />
              {status.using_system_key ? "System key" : "Connected"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600">
              <XCircleIcon className="w-3 h-3" />
              Not set
            </span>
          )}
        </div>
        {status.is_set && !status.using_system_key && (
          <span className="text-xs font-mono text-gray-400">{status.masked_key}</span>
        )}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={label.placeholder}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-9"
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
        <button
          onClick={handleSave}
          disabled={saving || !inputKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status.is_set && !status.using_system_key && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-red-600/80 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
