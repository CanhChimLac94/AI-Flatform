"use client";

import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { FlowCreateRequest, FlowUpdateRequest } from "@/lib/types";
import { useI18n } from "@/contexts/I18nContext";

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
  const { t } = useI18n();
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
      setError(t("flows.form.nameRequired", "Please enter a flow name."));
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
      setError(err instanceof Error ? err.message : t("errors.saveFailed", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            {mode === "create"
              ? t("flows.form.createTitle", "New flow")
              : t("flows.form.editTitle", "Edit flow info")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800"
            aria-label={t("common.close", "Close")}
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
            <span className="text-xs font-medium text-gray-400">
              {t("flows.form.nameLabel", "Flow name *")}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              placeholder={t("flows.form.namePlaceholder", "e.g. Software development workflow")}
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-400">
              {t("flows.form.descriptionLabel", "Description")}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 resize-none"
              placeholder={t("flows.form.descriptionPlaceholder", "Brief description of this flow…")}
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg"
            >
              {saving
                ? t("flows.form.saving", "Saving…")
                : mode === "create"
                  ? t("flows.form.createButton", "Create flow")
                  : t("common.save", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
