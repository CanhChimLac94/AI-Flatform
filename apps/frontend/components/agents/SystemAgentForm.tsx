"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type {
  AgentCategory,
  SystemAgent,
  SystemAgentCreateRequest,
  SystemAgentUpdateRequest,
} from "@/lib/types";
import { GroupedModelSelect } from "@/components/common/GroupedModelSelect";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useI18n } from "@/contexts/I18nContext";
import { categoryBadgeClass } from "./CategoryBadge";
import { IconPicker } from "./IconPicker";
import { AgentIcon } from "./AgentIcon";

interface Props {
  categories: AgentCategory[];
  initial?: SystemAgent;
  onSubmit: (data: SystemAgentCreateRequest | SystemAgentUpdateRequest) => Promise<void>;
  onCancel: () => void;
}

const ALL_TOOLS = [{ id: "web_search", labelKey: "agents.form.toolWebSearch" }];

export function SystemAgentForm({ categories, initial, onSubmit, onCancel }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(
    initial?.categories.map((c) => c.id) ?? [],
  );
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { groups: modelGroups, loading: loadingModels } = useModelCatalog();

  const toggleTool = (id: string) => {
    setTools((prev) => (prev.includes(id) ? prev.filter((toolId) => toolId !== id) : [...prev, id]));
  };

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("agents.form.systemNameRequired", "Agent name is required"));
      return;
    }
    if (categoryIds.length === 0) {
      setError(t("agents.form.categoriesRequired", "Select at least one category"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        model: model.trim() || undefined,
        tools,
        icon,
        category_ids: categoryIds,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.saveFailed", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-white">
            {initial
              ? t("agents.form.systemEditTitle", "Edit system agent")
              : t("agents.form.systemCreateTitle", "Create system agent")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-500 hover:text-gray-300"
            aria-label={t("common.close", "Close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t("agents.form.nameLabel", "Name *")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agents.form.namePlaceholder", "e.g. Python Expert")}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <IconPicker value={icon} onChange={setIcon} label={t("agents.form.iconLabel", "Display icon")} />

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t("agents.form.descriptionLabel", "Description")}
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("agents.form.descriptionPlaceholder", "What does this agent do?")}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              {t("agents.form.systemCategoriesLabel", "Topics / domains * (multi-select)")}
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const selected = categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selected
                        ? "bg-accent text-white border-accent"
                        : `${categoryBadgeClass(cat.color)} opacity-70 hover:opacity-100`
                    }`}
                  >
                    <AgentIcon icon={cat.icon} name={cat.name} className="w-3.5 h-3.5 shrink-0" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t("agents.form.systemPromptRequired", "System prompt *")}
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t(
                "agents.form.systemPromptPlaceholder",
                "You are a senior Python engineer who gives concise, idiomatic answers and always includes type hints.",
              )}
              rows={5}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t("agents.form.modelOptionalLabel", "Model (optional)")}
            </label>
            <GroupedModelSelect
              groups={modelGroups}
              value={model}
              onChange={(modelId) => setModel(modelId)}
              emptyOption={
                loadingModels
                  ? t("common.loading", "Loading...")
                  : t("agents.form.modelSystemDefault", "System default")
              }
              loading={loadingModels}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">
              {t("agents.form.toolsLabel", "Tools")}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_TOOLS.map((tool) => (
                <label key={tool.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tools.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                    className="accent-accent"
                  />
                  {t(tool.labelKey, "Web search")}
                </label>
              ))}
            </div>
          </div>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 text-sm font-medium bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving
              ? t("agents.form.saving", "Saving…")
              : initial
                ? t("agents.form.updateAgent", "Update")
                : t("agents.form.createAgent", "Create agent")}
          </button>
        </div>
      </div>
    </div>
  );
}
