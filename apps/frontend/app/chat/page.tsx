"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MobileMenuButton } from "@/components/layout/MobileMenuButton";
import { MessageList } from "@/components/chat/MessageList";
import { ModelBadge } from "@/components/chat/ModelBadge";
import { ProviderModelSelector } from "@/components/chat/ProviderModelSelector";
import { SmartInputBar } from "@/components/input/SmartInputBar";
import { AgentSelector } from "@/components/agents/AgentSelector";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import type { Agent, AttachmentRef, SystemAgent } from "@/lib/types";
import { listAgents, listSystemAgents, getUserSettings, assignAgentToConversation } from "@/lib/api";
import { loadGuestAgents } from "@/lib/agentStore";

function ChatPageContent() {
  const { isAuthenticated } = useAuth();
  const { locale, setLocale } = useI18n();
  const searchParams = useSearchParams();
  const [convId, setConvId] = useState<string | undefined>(undefined);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [systemAgents, setSystemAgents] = useState<SystemAgent[]>([]);
  const [pendingTitleUpdate, setPendingTitleUpdate] = useState<{ id: string; title: string } | null>(null);

  const handleConvUpdate = useCallback((id: string, title: string) => {
    setPendingTitleUpdate({ id, title });
    setConvId((prev) => prev ?? id);
  }, []);

  const { messages, sendMessage, stop, clearMessages, loadHistory } = useChat(convId, activeAgentId, handleConvUpdate);

  useEffect(() => {
    listSystemAgents().then(setSystemAgents).catch(() => setSystemAgents([]));
    if (isAuthenticated) {
      listAgents().then(setAgents).catch(() => setAgents([]));
      getUserSettings()
        .then((s) => {
          if (s.default_provider) setSelectedProvider(s.default_provider);
          if (s.default_model) setSelectedModel(s.default_model);
        })
        .catch(() => {});
    } else {
      setAgents(loadGuestAgents());
    }
  }, [isAuthenticated]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const activeProvider = lastAssistant?.metadata?.provider;
  const activeModel = lastAssistant?.metadata?.model;

  const handleSelectConv = useCallback((id: string) => {
    setConvId(id);
    setActiveAgentId(null);
    clearMessages();
    if (isAuthenticated && id) loadHistory(id);
  }, [clearMessages, loadHistory, isAuthenticated]);

  const handleNewConv = useCallback((id: string) => {
    setConvId(id || undefined);
    setActiveAgentId(null);
    clearMessages();
  }, [clearMessages]);

  useEffect(() => {
    const c = searchParams.get("c");
    if (c && isAuthenticated && c !== convId) {
      handleSelectConv(c);
    }
  }, [searchParams, isAuthenticated, convId, handleSelectConv]);

  const handleSend = useCallback(
    (content: string, model: "auto" | "speed" | "quality", tools: string[], attachments: AttachmentRef[]) => {
      sendMessage(content, model, tools, attachments, selectedProvider || undefined, selectedModel || undefined);
    },
    [sendMessage, selectedProvider, selectedModel]
  );

  const handleSelectAgent = useCallback(async (agentId: string | null) => {
    setActiveAgentId(agentId);
    if (isAuthenticated && convId) {
      try {
        await assignAgentToConversation(convId, agentId);
      } catch {
        // Non-critical
      }
    }
  }, [isAuthenticated, convId]);

  const isCurrentlyStreaming = messages.some((m) => m.isStreaming);

  return (
    <AppShell
      sidebarProps={{
        activeConvId: convId,
        onSelectConv: handleSelectConv,
        onNewConv: handleNewConv,
        pendingTitleUpdate,
      }}
    >
      <ChatPageMain
        convId={convId}
        locale={locale}
        setLocale={setLocale}
        agents={agents}
        systemAgents={systemAgents}
        activeAgentId={activeAgentId}
        onSelectAgent={handleSelectAgent}
        activeModel={activeModel}
        activeProvider={activeProvider}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onProviderChange={setSelectedProvider}
        onModelChange={setSelectedModel}
        isCurrentlyStreaming={isCurrentlyStreaming}
        messages={messages}
        onSend={handleSend}
        onStop={stop}
        onRegenerate={(msgId) => {
          const msg = messages.find((m) => m.id === msgId);
          if (msg) sendMessage(msg.content);
        }}
      />
    </AppShell>
  );
}

interface ChatPageMainProps {
  convId?: string;
  locale: string;
  setLocale: (locale: "en" | "vi") => void;
  agents: Agent[];
  systemAgents: SystemAgent[];
  activeAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  activeModel?: string;
  activeProvider?: string;
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (v: string) => void;
  onModelChange: (v: string) => void;
  isCurrentlyStreaming: boolean;
  messages: ReturnType<typeof useChat>["messages"];
  onSend: (content: string, model: "auto" | "speed" | "quality", tools: string[], attachments: AttachmentRef[]) => void;
  onStop: () => void;
  onRegenerate: (msgId: string) => void;
}

function ChatPageMain({
  convId,
  locale,
  setLocale,
  agents,
  systemAgents,
  activeAgentId,
  onSelectAgent,
  activeModel,
  activeProvider,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  isCurrentlyStreaming,
  messages,
  onSend,
  onStop,
  onRegenerate,
}: ChatPageMainProps) {
  return (
    <>
      <header className="shrink-0 border-b border-gray-700 px-4 sm:px-6 py-3 space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuButton />
          <h1 className="flex-1 text-sm font-medium text-gray-300 truncate min-w-0">
            {convId ? "Conversation" : "New conversation"}
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setLocale(locale === "en" ? "vi" : "en")}
              className="px-2 py-1 text-xs font-semibold rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
              title={locale === "en" ? "Switch to Tiếng Việt" : "Switch to English"}
            >
              {locale === "en" ? "VI" : "EN"}
            </button>
            <AgentSelector
              agents={agents}
              systemAgents={systemAgents}
              activeAgentId={activeAgentId}
              onSelect={onSelectAgent}
            />
            <div className="hidden sm:block">
              <ModelBadge model={activeModel} provider={activeProvider} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProviderModelSelector
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            disabled={isCurrentlyStreaming}
          />
          <div className="sm:hidden">
            <ModelBadge model={activeModel} provider={activeProvider} />
          </div>
        </div>
      </header>

      <MessageList messages={messages} onRegenerate={onRegenerate} />

      <SmartInputBar onSend={onSend} onStop={onStop} isStreaming={isCurrentlyStreaming} />
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-chat-bg text-gray-500 text-sm">Loading…</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
