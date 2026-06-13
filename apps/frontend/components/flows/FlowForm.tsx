"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { FlowCreateRequest, FlowUpdateRequest } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  initialName?: string;
  initialDescription?: string;
  onSubmit: (data: FlowCreateRequest | FlowUpdateRequest) => Promise<void>;
  onClose: () => void;
}

export function FlowForm({
  mode,
  initialName = "",
  initialDescription = "",
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
  }, [initialName, initialDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vui lòng nhập tên flow.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            {mode === "create" ? "Tạo flow mới" : "Sửa thông tin flow"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-400">Tên flow *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              placeholder="VD: Quy trình phát triển phần mềm"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-400">Mô tả</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 resize-none"
              placeholder="Mô tả ngắn về mục đích của flow..."
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg"
            >
              {saving ? "Đang lưu..." : mode === "create" ? "Tạo flow" : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
