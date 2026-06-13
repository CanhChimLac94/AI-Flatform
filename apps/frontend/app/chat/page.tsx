"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MobileMenuButton } from "@/components/layout/MobileMenuButton";
import { AppUserMenu } from "@/components/layout/AppUserMenu";
import { MessageList } from "@/components/chat/MessageList";
import { SmartInputBar } from "@/components/input/SmartInputBar";
import type { ModelPref } from "@/components/chat/ChatOptionsMenu";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import type { Agent, AttachmentRef, SystemAgent } from "@/lib/types";
import { listAgents, listSystemAgents, getUserSettings, assignAgentToConversation } from "@/lib/api";
import { loadGuestAgents } from "@/lib/agentStore";
import { useI18n } from "@/contexts/I18nContext";

function ChatPageContent() {
  const { isAuthenticated } = useAuth();
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
    (content: string, model: ModelPref, tools: string[], attachments: AttachmentRef[]) => {
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
        agents={agents}
        systemAgents={systemAgents}
        activeAgentId={activeAgentId}
        onSelectAgent={handleSelectAgent}
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
  agents: Agent[];
  systemAgents: SystemAgent[];
  activeAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (v: string) => void;
  onModelChange: (v: string) => void;
  isCurrentlyStreaming: boolean;
  messages: ReturnType<typeof useChat>["messages"];
  onSend: (content: string, model: ModelPref, tools: string[], attachments: AttachmentRef[]) => void;
  onStop: () => void;
  onRegenerate: (msgId: string) => void;
}

function ChatPageMain({
  convId,
  agents,
  systemAgents,
  activeAgentId,
  onSelectAgent,
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
  const { t } = useI18n();

  return (
    <>
      <header className="shrink-0 border-b border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuButton />
          <h1 className="flex-1 text-sm font-medium text-gray-300 truncate min-w-0">
            {convId ? t("chat.conversation") : t("chat.newConversation")}
          </h1>
          <AppUserMenu />
        </div>
      </header>

      <MessageList messages={messages} onRegenerate={onRegenerate} />

      <SmartInputBar
        onSend={onSend}
        onStop={onStop}
        isStreaming={isCurrentlyStreaming}
        agents={agents}
        systemAgents={systemAgents}
        activeAgentId={activeAgentId}
        onSelectAgent={onSelectAgent}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
        optionsDisabled={isCurrentlyStreaming}
      />
    </>
  );
}

export default function ChatPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-chat-bg text-gray-500 text-sm">{t("app.loading")}</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
