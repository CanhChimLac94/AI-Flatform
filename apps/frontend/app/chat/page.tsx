"use client";

// STEP 5.1-5.3: Main 3-column chat page
// Layout: Sidebar | Chat Window | (Citation panel slides in on [n] click)

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MessageList } from "@/components/chat/MessageList";
import { ModelBadge } from "@/components/chat/ModelBadge";
import { ProviderModelSelector } from "@/components/chat/ProviderModelSelector";
import { SmartInputBar } from "@/components/input/SmartInputBar";
import { AgentSelector } from "@/components/agents/AgentSelector";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import type { Agent, AttachmentRef } from "@/lib/types";
import { listAgents, getUserSettings, assignAgentToConversation } from "@/lib/api";
import { loadGuestAgents } from "@/lib/agentStore";

export default function ChatPage() {
  const { isAuthenticated } = useAuth();
  const { locale, setLocale } = useI18n();
  const [convId, setConvId] = useState<string | undefined>(undefined);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<string>("");
    const [selectedModel, setSelectedModel] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingTitleUpdate, setPendingTitleUpdate] = useState<{ id: string; title: string } | null>(null);

  const handleConvUpdate = useCallback((id: string, title: string) => {
    setPendingTitleUpdate({ id, title });
    setConvId((prev) => prev ?? id);
  }, []);

  const { messages, sendMessage, stop, clearMessages, loadHistory } = useChat(convId, activeAgentId, handleConvUpdate);

  // Load agents list and user default provider/model on mount
  useEffect(() => {
    if (isAuthenticated) {
      listAgents().then(setAgents).catch(() => setAgents([]));
      getUserSettings()
        .then((s) => {
          if (s.default_provider) setSelectedProvider(s.default_provider);
          if (s.default_model) setSelectedModel(s.default_model);
        })
        .catch(() => {/* keep empty — provider selector will pick first available */});
    } else {
      setAgents(loadGuestAgents());
    }
  }, [isAuthenticated]);

  // Derive active model from the last assistant message
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

  const handleSend = useCallback(
    (content: string, model: "auto" | "speed" | "quality", tools: string[], attachments: AttachmentRef[]) => {
      sendMessage(content, model, tools, attachments, selectedProvider || undefined, selectedModel || undefined);
    },
    [sendMessage, selectedProvider, selectedModel]
  );

  const handleSelectAgent = useCallback(async (agentId: string | null) => {
    setActiveAgentId(agentId);
    // Persist agent assignment on the conversation when authenticated
    if (isAuthenticated && convId) {
      try {
        await assignAgentToConversation(convId, agentId);
      } catch {
        // Non-critical — agent will still be applied via req.agent_id
      }
    }
  }, [isAuthenticated, convId]);

  const isCurrentlyStreaming = messages.some((m) => m.isStreaming);

  return (
    <div className="flex h-screen overflow-hidden bg-chat-bg">
      {/* Left Sidebar (AiChat-UIUX-Wireframe §I) */}
      <Sidebar
        activeConvId={convId}
        onSelectConv={handleSelectConv}
        onNewConv={handleNewConv}
        pendingTitleUpdate={pendingTitleUpdate}
      />

      {/* Main Chat Window */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700 shrink-0 gap-3">
          <h1 className="text-sm font-medium text-gray-300 truncate">
            {convId ? "Conversation" : "New conversation"}
          </h1>
                    <ProviderModelSelector
                      selectedProvider={selectedProvider}
                      selectedModel={selectedModel}
                      onProviderChange={setSelectedProvider}
                      onModelChange={setSelectedModel}
                      disabled={isCurrentlyStreaming}
                    />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === "en" ? "vi" : "en")}
              className="px-2 py-1 text-xs font-semibold rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
              title={locale === "en" ? "Switch to Tiếng Việt" : "Switch to English"}
            >
              {locale === "en" ? "VI" : "EN"}
            </button>
            <AgentSelector
              agents={agents}
              activeAgentId={activeAgentId}
              onSelect={handleSelectAgent}
            />
            <ModelBadge model={activeModel} provider={activeProvider} />
          </div>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          onRegenerate={(msgId) => {
            const msg = messages.find((m) => m.id === msgId);
            if (msg) sendMessage(msg.content);
          }}
        />

        {/* Smart Input Bar (5.2 streaming + 5.3 multimodal) */}
        <SmartInputBar
          onSend={handleSend}
          onStop={stop}
          isStreaming={isCurrentlyStreaming}
        />
      </main>
    </div>
  );
}
