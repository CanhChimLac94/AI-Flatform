"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import type { ProviderModelEntry, ProviderModelGroup } from "@/lib/types";
import { PROVIDERS } from "@/lib/types";
import { getProviderVisual } from "@/lib/providerVisuals";
import {
  listProviderModelGroups,
  createProviderModel,
  updateProviderModel,
  deleteProviderModel,
} from "@/lib/api";
import { ProviderChannelSelect } from "./ProviderChannelSelect";

function displayLabel(entry: ProviderModelEntry): string {
  return entry.display_name?.trim() || entry.model_id;
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        checked ? "bg-emerald-500" : "bg-gray-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ModelTableRow({
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
    const trimmedId = modelId.trim();
    if (!trimmedId) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        model_id: trimmedId !== entry.model_id ? trimmedId : undefined,
        display_name: displayName.trim() || null,
      });
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      await onToggle(enabled);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Xóa model "${displayLabel(entry)}" khỏi kênh này?`)) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Xóa thất bại");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <tr className="bg-surface-muted">
        <td colSpan={5} className="px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted mb-1">Model ID</label>
              <input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="vd. openai/gpt-4o"
                className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">Tên hiển thị</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tùy chọn"
                className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !modelId.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-on-accent rounded-lg"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              Lưu
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-muted hover:text-foreground border border-border rounded-lg"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              Hủy
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-t border-border transition-colors ${
        entry.is_enabled ? "hover:bg-surface-hover" : "opacity-70 hover:opacity-90 hover:bg-surface-hover"
      }`}
    >
      <td className="px-3 sm:px-4 py-3">
        <code className="text-xs text-sky-500 font-mono break-all">{entry.model_id}</code>
      </td>
      <td className="px-3 sm:px-4 py-3">
        <span className="text-sm text-foreground">{entry.display_name?.trim() || "—"}</span>
      </td>
      <td className="px-3 sm:px-4 py-3">
        <span
          className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium ${
            entry.is_builtin
              ? "bg-surface-elevated text-muted border-border"
              : "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
          }`}
        >
          {entry.is_builtin ? "Mặc định" : "Tùy chỉnh"}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-3">
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={entry.is_enabled}
            onChange={handleToggle}
            disabled={busy}
            label={entry.is_enabled ? "Tắt model" : "Bật model"}
          />
          <span
            className={`text-xs font-medium ${
              entry.is_enabled ? "text-emerald-500" : "text-muted"
            }`}
          >
            {entry.is_enabled ? "Đang bật" : "Đã tắt"}
          </span>
        </div>
      </td>
      <td className="px-3 sm:px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="p-1.5 text-muted hover:text-foreground rounded transition-colors"
            title="Sửa"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="p-1.5 text-muted hover:text-red-400 rounded transition-colors"
            title="Xóa"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProviderPanel({
  group,
  onUpdated,
}: {
  group: ProviderModelGroup;
  onUpdated: () => void;
}) {
  const visual = getProviderVisual(group.provider, group.provider_name);
  const Icon = visual.icon;
  const [showAdd, setShowAdd] = useState(false);
  const [newModelId, setNewModelId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const enabledCount = group.models.filter((m) => m.is_enabled).length;

  const handleToggle = async (entry: ProviderModelEntry, enabled: boolean) => {
    await updateProviderModel(group.provider, entry.id, { is_enabled: enabled });
    onUpdated();
  };

  const handleSave = async (
    entry: ProviderModelEntry,
    patch: { model_id?: string; display_name?: string | null },
  ) => {
    await updateProviderModel(group.provider, entry.id, patch);
    onUpdated();
  };

  const handleDelete = async (entry: ProviderModelEntry) => {
    await deleteProviderModel(group.provider, entry.id);
    onUpdated();
  };

  const handleAdd = async () => {
    const model_id = newModelId.trim();
    if (!model_id) return;
    setAdding(true);
    setAddError(null);
    try {
      await createProviderModel(group.provider, {
        model_id,
        display_name: newDisplayName.trim() || null,
      });
      setNewModelId("");
      setNewDisplayName("");
      setShowAdd(false);
      onUpdated();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Thêm thất bại");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={`rounded-xl border overflow-hidden bg-surface ${visual.panelClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-border bg-surface-muted">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 ${visual.badgeClass}`}
          >
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{group.provider_name}</h3>
            <p className="text-[11px] text-muted mt-0.5">
              {enabledCount}/{group.models.length} model đang bật ·{" "}
              <span className="font-mono text-muted">{group.provider}</span>
            </p>
          </div>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-on-accent bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            Thêm model
          </button>
        )}
      </div>

      {showAdd && (
        <div className="px-4 py-3 border-b border-border bg-surface-muted space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted mb-1">Model ID *</label>
              <input
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder="vd. openai/gpt-4o"
                className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">Tên hiển thị</label>
              <input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Tùy chọn"
                className="w-full bg-input-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newModelId.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-on-accent rounded-lg"
            >
              {adding ? "Đang thêm…" : "Thêm"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddError(null); }}
              className="px-3 py-1.5 text-xs text-muted hover:text-foreground border border-border rounded-lg"
            >
              Hủy
            </button>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
        </div>
      )}

      <div className="overflow-x-auto -mx-px">
        <table className="w-full text-left table-fixed sm:table-auto">
          <thead>
            <tr className="bg-surface-muted text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 sm:px-4 py-2.5 font-semibold min-w-[200px]">Model ID</th>
              <th className="px-3 sm:px-4 py-2.5 font-semibold min-w-[120px]">Tên hiển thị</th>
              <th className="px-3 sm:px-4 py-2.5 font-semibold w-28">Loại</th>
              <th className="px-3 sm:px-4 py-2.5 font-semibold min-w-[140px]">Trạng thái</th>
              <th className="px-3 sm:px-4 py-2.5 font-semibold w-24 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {group.models.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  Chưa có model nào cho kênh này.
                </td>
              </tr>
            ) : (
              group.models.map((entry) => (
                <ModelTableRow
                  key={entry.id}
                  entry={entry}
                  onToggle={(enabled) => handleToggle(entry, enabled)}
                  onSave={(patch) => handleSave(entry, patch)}
                  onDelete={() => handleDelete(entry)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessDeniedPanel({
  isAuthenticated,
  isAuthReady,
}: {
  isAuthenticated: boolean;
  isAuthReady: boolean;
}) {
  if (!isAuthReady) {
    return <div className="h-40 rounded-xl bg-surface-muted animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-border bg-surface-muted px-6 py-10 text-center">
      <ShieldExclamationIcon className="w-12 h-12 text-amber-400/80 mx-auto mb-4" />
      <h3 className="text-sm font-semibold text-foreground mb-2">Không có quyền quản lý model</h3>
      <p className="text-sm text-muted max-w-md mx-auto">
        {!isAuthenticated
          ? "Bạn cần đăng nhập bằng tài khoản admin để quản lý danh sách model theo kênh."
          : "Chỉ tài khoản admin mới có thể thêm, sửa, xóa hoặc bật/tắt model."}
      </p>
      {!isAuthenticated && (
        <Link
          href="/auth/login"
          className="inline-flex mt-5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-on-accent rounded-lg transition-colors"
        >
          Đăng nhập
        </Link>
      )}
    </div>
  );
}

export function ProviderModelsSection({
  canManage,
  isAuthenticated,
  isAuthReady = true,
  embedded = false,
}: {
  canManage: boolean;
  isAuthenticated: boolean;
  isAuthReady?: boolean;
  embedded?: boolean;
}) {
  const [groups, setGroups] = useState<ProviderModelGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0]?.id ?? "groq");

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      setGroups(await listProviderModelGroups());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tải danh sách model thất bại");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const enabledCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      counts[g.provider] = g.models.filter((m) => m.is_enabled).length;
    }
    return counts;
  }, [groups]);

  const activeGroup = groups.find((g) => g.provider === activeProvider);

  if (!canManage) {
    return (
      <AccessDeniedPanel
        isAuthenticated={isAuthenticated}
        isAuthReady={isAuthReady}
      />
    );
  }

  return (
    <div className="space-y-4">
      {embedded && (
        <h3 className="text-sm font-semibold text-foreground">Quản lý model theo kênh</h3>
      )}

      {loading ? (
        <div className="h-48 rounded-xl bg-surface-muted animate-pulse" />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <>
          <div>
            <label className="block text-xs text-muted mb-2">Chọn kênh (provider)</label>
            <ProviderChannelSelect
              value={activeProvider}
              onChange={setActiveProvider}
              enabledCounts={enabledCounts}
            />
          </div>

          {activeGroup ? (
            <ProviderPanel group={activeGroup} onUpdated={load} />
          ) : null}
        </>
      )}
    </div>
  );
}
