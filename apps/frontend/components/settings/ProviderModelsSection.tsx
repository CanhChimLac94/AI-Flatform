"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import type { ProviderModelEntry, ProviderModelGroup } from "@/lib/types";
import { PROVIDERS } from "@/lib/types";
import {
  listProviderModelGroups,
  createProviderModel,
  updateProviderModel,
  deleteProviderModel,
} from "@/lib/api";
import {
  getGuestProviderModelGroups,
  ensureGuestProviderModelsSaved,
  guestCreateProviderModel,
  guestUpdateProviderModel,
  guestDeleteProviderModel,
} from "@/lib/guestProviderModels";

function displayLabel(entry: ProviderModelEntry): string {
  return entry.display_name?.trim() || entry.model_id;
}

function ModelRow({
  entry,
  onToggle,
  onSave,
  onDelete,
}: {
  entry: ProviderModelEntry;
  onToggle: (enabled: boolean) => Promise<void>;
  onSave: (patch: { model_id?: string; display_name?: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [modelId, setModelId] = useState(entry.model_id);
  const [displayName, setDisplayName] = useState(entry.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setModelId(entry.model_id);
    setDisplayName(entry.display_name ?? "");
  }, [entry]);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        model_id: entry.is_builtin ? undefined : modelId.trim(),
        display_name: displayName.trim() || null,
      });
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    setBusy(true);
    try {
      await onToggle(!entry.is_enabled);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Xóa model "${displayLabel(entry)}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors ${
        entry.is_enabled
          ? "border-gray-600 bg-gray-900/60"
          : "border-gray-700/60 bg-gray-900/30 opacity-70"
      }`}
    >
      {editing ? (
        <div className="space-y-2">
          {!entry.is_builtin && (
            <input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="Model ID (vd. gpt-4o)"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            />
          )}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tên hiển thị (tùy chọn)"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || (!entry.is_builtin && !modelId.trim())}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              Lưu
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              Hủy
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <label className="flex items-center pt-0.5 cursor-pointer shrink-0" title={entry.is_enabled ? "Tắt model" : "Bật model"}>
            <input
              type="checkbox"
              checked={entry.is_enabled}
              onChange={handleToggle}
              disabled={busy}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/40"
            />
          </label>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-medium ${entry.is_enabled ? "text-white" : "text-gray-400"}`}>
                {displayLabel(entry)}
              </span>
              {entry.is_builtin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 border border-gray-600">
                  Mặc định
                </span>
              )}
            </div>
            {entry.display_name && (
              <p className="text-[11px] font-mono text-gray-500 truncate mt-0.5">{entry.model_id}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="p-1.5 text-gray-500 hover:text-gray-300 rounded transition-colors"
              title="Sửa"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            {!entry.is_builtin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="p-1.5 text-gray-600 hover:text-red-400 rounded transition-colors"
                title="Xóa"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderPanel({
  group,
  isAuthenticated,
  onUpdated,
}: {
  group: ProviderModelGroup;
  isAuthenticated: boolean;
  onUpdated: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const enabledCount = group.models.filter((m) => m.is_enabled).length;

  const handleToggle = async (entry: ProviderModelEntry, enabled: boolean) => {
    if (isAuthenticated) {
      await updateProviderModel(group.provider, entry.id, { is_enabled: enabled });
    } else {
      guestUpdateProviderModel(group.provider, entry.id, { is_enabled: enabled });
    }
    onUpdated();
  };

  const handleSave = async (
    entry: ProviderModelEntry,
    patch: { model_id?: string; display_name?: string | null },
  ) => {
    if (isAuthenticated) {
      await updateProviderModel(group.provider, entry.id, patch);
    } else {
      guestUpdateProviderModel(group.provider, entry.id, patch);
    }
    onUpdated();
  };

  const handleDelete = async (entry: ProviderModelEntry) => {
    if (isAuthenticated) {
      await deleteProviderModel(group.provider, entry.id);
    } else {
      guestDeleteProviderModel(group.provider, entry.id);
    }
    onUpdated();
  };

  const handleAdd = async () => {
    const model_id = newModelId.trim();
    if (!model_id) return;
    setAdding(true);
    setAddError(null);
    try {
      if (isAuthenticated) {
        await createProviderModel(group.provider, {
          model_id,
          display_name: newDisplayName.trim() || null,
        });
      } else {
        guestCreateProviderModel(group.provider, model_id, newDisplayName.trim() || null);
      }
      setNewModelId("");
      setNewDisplayName("");
      setShowAdd(false);
      onUpdated();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-700/80 bg-gray-800/80">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{group.provider_name}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {enabledCount}/{group.models.length} model đang bật
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors shrink-0"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Thêm model
          </button>
        )}
      </div>

      <div className="p-4 space-y-2">
        {showAdd && (
          <div className="rounded-lg border border-gray-600 bg-gray-900 p-3 space-y-2 mb-3">
            <input
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder="Model ID (vd. openai/gpt-4o)"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Tên hiển thị (tùy chọn)"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || !newModelId.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg"
              >
                {adding ? "Đang thêm…" : "Thêm"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setAddError(null); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg"
              >
                Hủy
              </button>
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
          </div>
        )}

        {group.models.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">Chưa có model nào.</p>
        ) : (
          group.models.map((entry) => (
            <ModelRow
              key={entry.id}
              entry={entry}
              onToggle={(enabled) => handleToggle(entry, enabled)}
              onSave={(patch) => handleSave(entry, patch)}
              onDelete={() => handleDelete(entry)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ProviderModelsSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [groups, setGroups] = useState<ProviderModelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0]?.id ?? "groq");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        setGroups(await listProviderModelGroups());
      } else {
        ensureGuestProviderModelsSaved();
        setGroups(getGuestProviderModelGroups());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const activeGroup = groups.find((g) => g.provider === activeProvider);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <CpuChipIcon className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-white">Quản lý model theo kênh</h2>
          <p className="text-xs text-gray-400 mt-1">
            Bật/tắt, thêm, sửa hoặc xóa model cho từng provider. Chỉ model đang bật mới xuất hiện khi chat.
            {!isAuthenticated && " (Lưu cục bộ trên trình duyệt.)"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-gray-800/50 animate-pulse" />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const enabled = g.models.filter((m) => m.is_enabled).length;
              const active = g.provider === activeProvider;
              return (
                <button
                  key={g.provider}
                  type="button"
                  onClick={() => setActiveProvider(g.provider)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    active
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                  }`}
                >
                  {g.provider_name}
                  <span className="ml-1.5 text-[10px] opacity-70">{enabled}</span>
                </button>
              );
            })}
          </div>

          {activeGroup ? (
            <ProviderPanel
              group={activeGroup}
              isAuthenticated={isAuthenticated}
              onUpdated={load}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
