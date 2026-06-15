"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SparklesIcon,
  XMarkIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import type {
  AgentCategory,
  AgentCreateRequest,
  AgentDesignMessage,
  AgentDraft,
  SystemAgentCreateRequest,
} from "@/lib/types";
import { designAgentChat, getUserSettings } from "@/lib/api";
import { loadGuestSettings } from "@/lib/guestSettings";
import {
  filterDesignCatalogGroups,
  pickDesignModelForProvider,
} from "@/lib/agentDesignLlm";
import { isConfiguredApiKey } from "@/lib/providerModelCatalog";
import { DesignChatModelMenu } from "./DesignChatModelMenu";
import { useChatModelCatalog } from "@/hooks/useChatModelCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { AgentIcon } from "./AgentIcon";
import { CategoryBadge } from "./CategoryBadge";

export type AgentDesignScope = "personal" | "system";

interface Props {
  scope: AgentDesignScope;
  categories: AgentCategory[];
  onClose: () => void;
  onConfirm: (data: AgentCreateRequest | SystemAgentCreateRequest) => Promise<void>;
}

function categoryItems(draft: AgentDraft, categories: AgentCategory[]): AgentCategory[] {
  const slugs = draft.category_slugs ?? [];
  return slugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is AgentCategory => Boolean(c));
}

export function AgentDesignChat({ scope, categories, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<AgentDesignMessage[]>([]);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designProvider, setDesignProvider] = useState("");
  const [designModel, setDesignModel] = useState("");
  const llmInitialized = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { groups: catalogGroups, loading: catalogLoading } = useChatModelCatalog();
  const designModelGroups = useMemo(
    () => filterDesignCatalogGroups(catalogGroups),
    [catalogGroups],
  );

  const guestApiKey = useMemo(() => {
    if (isAuthenticated || !designProvider) return "";
    return loadGuestSettings().apiKeys[designProvider] ?? "";
  }, [isAuthenticated, designProvider]);

  const hasUsableLlmKey = isAuthenticated || isConfiguredApiKey(guestApiKey);

  const openerText = t(
    "agents.designChat.opener",
    scope === "system"
      ? "Describe the system agent you want to create — its role, audience, and behavior. I'll propose a draft you can refine before saving."
      : "Describe the agent you want — what it should do, how it should respond, and any special rules. I'll draft it for you to review and confirm.",
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, draft, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (llmInitialized.current || catalogLoading) return;
    if (designModelGroups.length === 0) return;

    const applySelection = (provider: string, modelHint?: string) => {
      const providerOk = designModelGroups.some((g) => g.provider === provider)
        ? provider
        : designModelGroups[0].provider;
      setDesignProvider(providerOk);
      setDesignModel(pickDesignModelForProvider(designModelGroups, providerOk, modelHint));
    };

    if (isAuthenticated) {
      getUserSettings()
        .then((s) => applySelection(s.default_provider, s.default_model))
        .catch(() => applySelection(designModelGroups[0].provider))
        .finally(() => {
          llmInitialized.current = true;
        });
    } else {
      const gs = loadGuestSettings();
      applySelection(gs.preferredProvider, gs.preferredModelByProvider[gs.preferredProvider]);
      llmInitialized.current = true;
    }
  }, [isAuthenticated, catalogLoading, designModelGroups]);

  const handleDesignModelChange = (modelId: string, provider?: string) => {
    if (provider) setDesignProvider(provider);
    setDesignModel(modelId);
  };

  const buildLlmPayload = useCallback(() => {
    if (!designProvider || !designModel) return null;
    const base = { provider: designProvider, model: designModel };
    if (isAuthenticated) return base;
    const api_key = loadGuestSettings().apiKeys[designProvider] ?? "";
    return { ...base, api_key };
  }, [designProvider, designModel, isAuthenticated]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextMessages: AgentDesignMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const llm = buildLlmPayload();
      if (!llm?.provider || !llm.model) {
        throw new Error(
          t("agents.designChat.llmRequired", "Select a provider and model for the design assistant."),
        );
      }
      if (!isAuthenticated && !isConfiguredApiKey(llm.api_key)) {
        throw new Error(
          t(
            "agents.designChat.guestKeyRequired",
            "Configure an API key in Settings → API Keys (this session) before using AI design.",
          ),
        );
      }

      const apiMessages = nextMessages;

      const res = await designAgentChat({
        scope,
        messages: apiMessages,
        draft,
        provider: llm.provider,
        model: llm.model,
        ...(llm.api_key ? { api_key: llm.api_key } : {}),
      });

      setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
      if (res.draft) setDraft(res.draft);
      setReady(res.ready);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("agents.designChat.failed", "Design chat failed"));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const handleConfirm = async () => {
    if (!draft?.name?.trim() || !draft.system_prompt?.trim()) return;
    setConfirming(true);
    setError(null);
    try {
      const { draftToPersonalCreate, draftToSystemCreate } = await import("@/lib/agentDraft");
      const payload =
        scope === "system"
          ? draftToSystemCreate(draft, categories)
          : draftToPersonalCreate(draft, categories);
      await onConfirm(payload);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("agents.designChat.createFailed", "Create failed"));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-3 py-4 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[min(92vh,780px)] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-design-title"
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-700 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <SparklesIcon className="w-5 h-5 text-violet-400 shrink-0" />
            <h2 id="agent-design-title" className="text-sm font-semibold text-white truncate">
              {t("agents.designChat.title", "Create agent with AI")}
            </h2>
            <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
              {scope === "system"
                ? t("agents.designChat.scopeSystem", "System")
                : t("agents.designChat.scopePersonal", "Personal")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg"
            aria-label={t("common.close", "Close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Chat */}
          <div className="flex-1 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-700">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap bg-gray-800 text-gray-200 border border-gray-700">
                  {openerText}
                </div>
              </div>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600/90 text-white"
                        : "bg-gray-800 text-gray-200 border border-gray-700"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3 py-2 text-sm bg-gray-800 text-gray-400 border border-gray-700 animate-pulse">
                    {t("agents.designChat.thinking", "Thinking…")}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="px-4 py-2 text-xs text-red-400 bg-red-900/20 border-t border-red-900/40">
                {error}
              </p>
            )}

            <div className="shrink-0 border-t border-gray-700 bg-gray-900 px-3 py-3 overflow-visible">
              {!catalogLoading && designModelGroups.length === 0 && (
                <p className="text-[11px] text-amber-400 mb-2">
                  {t(
                    "agents.designChat.noModels",
                    "No supported models available. Add an API key for Groq, OpenAI, OpenRouter, or NVIDIA.",
                  )}
                </p>
              )}
              {!isAuthenticated && designProvider && !hasUsableLlmKey && (
                <p className="text-[11px] text-amber-400 mb-2">
                  {t(
                    "agents.designChat.noKeyForProvider",
                    "No API key for this provider in the current session.",
                  )}
                </p>
              )}

              <div className="flex items-end gap-2 bg-gray-800 rounded-2xl px-2 sm:px-3 py-2 border border-gray-600 focus-within:border-violet-500 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder={t(
                    "agents.designChat.placeholder",
                    "Describe your agent or ask for changes…",
                  )}
                  disabled={busy}
                  className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-500 leading-relaxed py-1 max-h-[120px] min-h-[2rem] disabled:opacity-50"
                />
                <div className="flex items-center gap-0.5 sm:gap-1 self-end pb-0.5 shrink-0 relative z-10">
                  <DesignChatModelMenu
                    groups={designModelGroups}
                    selectedProvider={designProvider}
                    selectedModel={designModel}
                    onChange={handleDesignModelChange}
                    loading={catalogLoading}
                    disabled={busy || designModelGroups.length === 0}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={
                      busy ||
                      !input.trim() ||
                      !designModel ||
                      !hasUsableLlmKey ||
                      designModelGroups.length === 0
                    }
                    className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
                    aria-label={t("common.send", "Send")}
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Draft preview */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col bg-gray-950/50 min-h-[200px] lg:min-h-0">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t("agents.designChat.draftPreview", "Draft preview")}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
              {!draft ? (
                <p className="text-gray-500 text-xs leading-relaxed">
                  {t(
                    "agents.designChat.draftEmpty",
                    "The proposed agent will appear here once the assistant has enough details.",
                  )}
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <AgentIcon icon={draft.icon} name={draft.name || "?"} className="w-5 h-5" />
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{draft.name || "—"}</p>
                      {draft.description && (
                        <p className="text-xs text-gray-400 line-clamp-2">{draft.description}</p>
                      )}
                    </div>
                  </div>
                  {categoryItems(draft, categories).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {categoryItems(draft, categories).map((cat) => (
                        <CategoryBadge key={cat.id} category={cat} />
                      ))}
                    </div>
                  )}
                  {draft.model && (
                    <p className="text-xs text-gray-400">
                      <span className="text-gray-500">{t("agents.model", "Model")}: </span>
                      <span className="font-mono">{draft.model}</span>
                    </p>
                  )}
                  {draft.tools && draft.tools.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {t("agents.form.tools", "Tools")}: {draft.tools.join(", ")}
                    </p>
                  )}
                  {scope === "personal" && draft.is_public && (
                    <p className="text-xs text-amber-400/90">
                      {t("agents.form.publicAgent", "Public agent")}
                    </p>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      {t("agents.systemPrompt", "System Prompt")}
                    </p>
                    <p className="text-xs text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto rounded-lg bg-gray-900/80 border border-gray-800 p-2">
                      {draft.system_prompt || "—"}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="p-3 border-t border-gray-800 space-y-2">
              {ready && draft && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircleIcon className="w-4 h-4 shrink-0" />
                  {t("agents.designChat.readyHint", "Draft is ready — confirm to create, or keep chatting to refine.")}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={!draft?.name?.trim() || !draft?.system_prompt?.trim() || confirming}
                className="w-full py-2.5 text-sm font-medium rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
              >
                {confirming
                  ? t("agents.designChat.creating", "Creating…")
                  : t("agents.designChat.confirmCreate", "Create agent")}
              </button>
              <p className="text-[10px] text-gray-600 text-center leading-snug">
                {t(
                  "agents.designChat.refineHint",
                  "Continue chatting to adjust name, prompt, categories, or tools before creating.",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
