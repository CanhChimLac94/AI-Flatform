"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { AgentCategory, AgentCategoryCreateRequest, AgentCategoryUpdateRequest } from "@/lib/types";
import { createAgentCategory, deleteAgentCategory, updateAgentCategory } from "@/lib/api";
import { AgentIcon } from "./AgentIcon";
import { IconPicker } from "./IconPicker";
import { categoryBadgeClass } from "./CategoryBadge";

const COLOR_OPTIONS = ["indigo", "cyan", "pink", "purple", "amber", "emerald", "blue", "rose"];

interface CategoryManagerProps {
  categories: AgentCategory[];
  onChange: () => void;
}

type FormMode = { type: "create" } | { type: "edit"; category: AgentCategory } | null;

export function CategoryManager({ categories, onChange }: CategoryManagerProps) {
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Nhóm phân loại</h2>
          <p className="text-xs text-gray-500 mt-0.5">Quản lý chủ đề/lĩnh vực cho agents hệ thống</p>
        </div>
        <button
          type="button"
          onClick={() => setFormMode({ type: "create" })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors self-start"
        >
          <PlusIcon className="w-4 h-4" />
          Thêm nhóm
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-gray-700 bg-gray-900/50"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <AgentIcon
                icon={cat.icon}
                name={cat.name}
                containerClassName={`flex items-center justify-center w-9 h-9 rounded-lg border shrink-0 ${categoryBadgeClass(cat.color)}`}
                className="w-4 h-4"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{cat.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {cat.slug}
                  {cat.description ? ` · ${cat.description}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setFormMode({ type: "edit", category: cat })}
                className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                title="Sửa nhóm"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(cat)}
                className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
                title="Xóa nhóm"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">Chưa có nhóm phân loại nào.</p>
        )}
      </div>

      {formMode && (
        <CategoryFormModal
          initial={formMode.type === "edit" ? formMode.category : undefined}
          onClose={() => setFormMode(null)}
          onSaved={() => {
            setFormMode(null);
            onChange();
          }}
          onError={setError}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-2">Xóa nhóm &quot;{deleteTarget.name}&quot;?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Agents trong nhóm sẽ mất liên kết với nhóm này. Hành động không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  try {
                    await deleteAgentCategory(deleteTarget.id);
                    setDeleteTarget(null);
                    onChange();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Xóa nhóm thất bại");
                    setDeleteTarget(null);
                  }
                }}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CategoryFormModal({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial?: AgentCategory;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "indigo");
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setLocalError("Tên nhóm là bắt buộc");
      return;
    }
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      if (initial) {
        const body: AgentCategoryUpdateRequest = {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          color: color || undefined,
          icon,
          sort_order: sortOrder,
        };
        await updateAgentCategory(initial.id, body);
      } else {
        const body: AgentCategoryCreateRequest = {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          color: color || undefined,
          icon,
          sort_order: sortOrder,
        };
        await createAgentCategory(body);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lưu thất bại";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h3 className="text-base font-semibold text-white">
            {initial ? "Sửa nhóm phân loại" : "Thêm nhóm phân loại"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {(localError) && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {localError}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Tên nhóm *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Slug (tùy chọn)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="tu-dong-neu-de-trong"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Mô tả</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Màu badge</label>
              <select
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Thứ tự hiển thị</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <IconPicker value={icon} onChange={setIcon} label="Icon nhóm" />
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 text-sm font-medium bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? "Đang lưu..." : initial ? "Cập nhật" : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}
