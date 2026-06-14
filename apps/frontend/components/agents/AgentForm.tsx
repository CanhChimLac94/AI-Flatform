"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentArrowUpIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Agent, AgentCategory, AgentCreateRequest, AgentKnowledgeFile, AgentUpdateRequest } from "@/lib/types";
import { deleteKnowledgeFile, listKnowledgeFiles, uploadKnowledgeFile } from "@/lib/api";
import { GroupedModelSelect } from "@/components/common/GroupedModelSelect";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useI18n } from "@/contexts/I18nContext";
import { IconPicker } from "./IconPicker";
import { AgentIcon } from "./AgentIcon";
import { categoryBadgeClass } from "./CategoryBadge";

interface Props {
  initial?: Agent;
  categories?: AgentCategory[];
  onSubmit: (data: AgentCreateRequest | AgentUpdateRequest) => Promise<void>;
  onCancel: () => void;
}

const ALL_TOOLS = [{ id: "web_search", labelKey: "agents.form.toolWebSearch" }];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AgentForm({ initial, categories = [], onSubmit, onCancel }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? false);
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null);
  const [categoryIds, setCategoryIds] = useState<string[]>(
    initial?.categories?.map((c) => c.id) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [knowledgeFiles, setKnowledgeFiles] = useState<AgentKnowledgeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { groups: modelGroups, loading: loadingModels } = useModelCatalog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial?.id) {
      listKnowledgeFiles(initial.id)
        .then(setKnowledgeFiles)
        .catch(() => setKnowledgeFiles([]));
    }
  }, [initial?.id]);

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.includes(id) ? prev.filter((toolId) => toolId !== id) : [...prev, id],
    );
  };

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("agents.form.nameRequired", "Name is required"));
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
        is_public: isPublic,
        icon,
        category_ids: categoryIds,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.saveFailed", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleKnowledgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initial?.id) return;
    e.target.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      const kf = await uploadKnowledgeFile(initial.id, file);
      setKnowledgeFiles((prev) => [...prev, kf]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : t("agents.form.uploadFailed", "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleKnowledgeDelete = async (kf: AgentKnowledgeFile) => {
    if (!initial?.id) return;
    try {
      await deleteKnowledgeFile(initial.id, kf.id);
      setKnowledgeFiles((prev) => prev.filter((f) => f.id !== kf.id));
    } catch {
      setUploadError(t("agents.form.deleteFileFailed", "Failed to delete file"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            {initial
              ? t("agents.form.editTitle", "Edit agent")
              : t("agents.form.createTitle", "New agent")}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-300"
            aria-label={t("common.close", "Close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              {t("agents.form.nameLabel", "Name *")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("agents.form.namePlaceholder", "e.g. Python Expert")}
              required
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <IconPicker value={icon} onChange={setIcon} label={t("agents.form.iconLabel", "Display icon")} />

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              {t("agents.form.descriptionLabel", "Description")}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("agents.form.descriptionPlaceholder", "What does this agent do?")}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {categories.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                {t("agents.form.categoriesLabel", "Categories (multi-select)")}
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
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              {t("agents.form.systemPromptLabel", "System prompt")}
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t(
                "agents.form.systemPromptPlaceholder",
                "You are a senior Python engineer who gives concise, idiomatic answers and always includes type hints.",
              )}
              rows={5}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              {t("agents.form.modelOverrideLabel", "Model override")}{" "}
              <span className="text-gray-600">{t("agents.form.modelOptional", "(optional)")}</span>
            </label>
            <GroupedModelSelect
              groups={modelGroups}
              value={model}
              onChange={(modelId) => setModel(modelId)}
              emptyOption={
                loadingModels
                  ? t("common.loading", "Loading...")
                  : t("agents.form.modelDefaultRouting", "Use intent routing (default)")
              }
              loading={loadingModels}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">
              {t("agents.form.toolsLabel", "Tools")}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => toggleTool(tool.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    tools.includes(tool.id)
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {t(tool.labelKey, "Web search")}
                </button>
              ))}
            </div>
          </div>

          {initial?.id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">
                  {t("agents.form.knowledgeBaseLabel", "Knowledge base")}{" "}
                  <span className="text-gray-600">
                    {t("agents.form.knowledgeFormats", "(PDF, DOCX, XLSX, TXT, MD)")}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
                >
                  <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                  {uploading
                    ? t("agents.form.uploading", "Uploading…")
                    : t("agents.form.uploadFile", "Upload file")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.txt,.md"
                  className="hidden"
                  onChange={handleKnowledgeUpload}
                />
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 mb-2">{uploadError}</p>
              )}

              {knowledgeFiles.length === 0 ? (
                <p className="text-xs text-gray-600 py-2 text-center border border-dashed border-gray-700 rounded-lg">
                  {t("agents.form.noDocuments", "No documents uploaded yet")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {knowledgeFiles.map((kf) => (
                    <li
                      key={kf.id}
                      className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white truncate">{kf.name}</p>
                        <p className="text-xs text-gray-500">{formatBytes(kf.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleKnowledgeDelete(kf)}
                        className="ml-3 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                        title={t("agents.form.removeFile", "Remove")}
                        aria-label={t("agents.form.removeFile", "Remove")}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!initial?.id && (
            <p className="text-xs text-gray-600 italic">
              {t("agents.form.saveFirstForKnowledge", "Save the agent first to upload knowledge documents.")}
            </p>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is-public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is-public" className="text-sm text-gray-300">
              {t("agents.form.publicLabel", "Public — visible to other users")}
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {saving
                ? t("agents.form.saving", "Saving…")
                : initial
                  ? t("agents.form.saveChanges", "Save changes")
                  : t("agents.form.createAgent", "Create agent")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
