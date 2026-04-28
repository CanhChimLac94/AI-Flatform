"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentArrowUpIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Agent, AgentCreateRequest, AgentKnowledgeFile, AgentUpdateRequest } from "@/lib/types";
import { PROVIDERS } from "@/lib/types";
import { deleteKnowledgeFile, listKnowledgeFiles, uploadKnowledgeFile } from "@/lib/api";

interface Props {
  initial?: Agent;
  onSubmit: (data: AgentCreateRequest | AgentUpdateRequest) => Promise<void>;
  onCancel: () => void;
}

const ALL_TOOLS = [
  { id: "web_search", label: "Web Search" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AgentForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Knowledge files (only available when editing an existing agent)
  const [knowledgeFiles, setKnowledgeFiles] = useState<AgentKnowledgeFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
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
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
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
      setUploadError(err instanceof Error ? err.message : "Upload failed");
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
      setUploadError("Failed to delete file");
    }
  };

  // Flat list of all available models from all providers
  const allModels = PROVIDERS.flatMap((p) => p.models.map((m) => ({ label: `${p.name} — ${m}`, value: m })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            {initial ? "Edit agent" : "New agent"}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Python Expert"
              required
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a senior Python engineer who gives concise, idiomatic answers and always includes type hints."
              rows={5}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Model override <span className="text-gray-600">(optional)</span></label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Use intent routing (default)</option>
              {allModels.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">Tools</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTool(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    tools.includes(t.id)
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge Base — only shown when editing an existing agent */}
          {initial?.id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">
                  Knowledge base <span className="text-gray-600">(PDF, DOCX, XLSX, TXT, MD)</span>
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 transition-colors"
                >
                  <DocumentArrowUpIcon className="w-3.5 h-3.5" />
                  {uploading ? "Uploading…" : "Upload file"}
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
                  No documents uploaded yet
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
                        title="Remove"
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
              Save the agent first to upload knowledge documents.
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
              Public — visible to other users
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {saving ? "Saving…" : initial ? "Save changes" : "Create agent"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
