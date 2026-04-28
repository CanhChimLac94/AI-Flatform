"use client";

import { useCallback, useReducer, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AttachmentRef, Citation, Message } from "@/lib/types";
import { useSSE } from "./useSSE";
import type { ChatRequest } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { loadGuestSettings, resolveModel } from "@/lib/guestSettings";
import { fetchConversationMessages } from "@/lib/api";

type Action =
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "START_STREAMING"; assistantId: string }
  | { type: "APPEND_DELTA"; assistantId: string; delta: string }
  | { type: "SET_STATUS"; assistantId: string; status: string }
  | { type: "SET_CITATIONS"; assistantId: string; citations: Citation[] }
  | { type: "FINISH_STREAMING"; assistantId: string; provider: string; model: string }
  | { type: "SET_DISCONNECTED"; assistantId: string }
  | { type: "CLEAR_MESSAGES" }
  | { type: "LOAD_MESSAGES"; messages: Message[] };

function reducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "ADD_MESSAGE":
      return [...state, action.message];
    case "START_STREAMING":
      return [...state, {
        id: action.assistantId, role: "assistant", content: "",
        isStreaming: true, statusText: "Thinking…",
      }];
    case "APPEND_DELTA":
      return state.map((m) =>
        m.id === action.assistantId
          ? { ...m, content: m.content + action.delta, statusText: undefined }
          : m
      );
    case "SET_STATUS":
      return state.map((m) =>
        m.id === action.assistantId ? { ...m, statusText: action.status } : m
      );
    case "SET_CITATIONS":
      return state.map((m) =>
        m.id === action.assistantId ? { ...m, citations: action.citations } : m
      );
    case "FINISH_STREAMING":
      return state.map((m) =>
        m.id === action.assistantId
          ? { ...m, isStreaming: false, statusText: undefined,
              metadata: { provider: action.provider, model: action.model } }
          : m
      );
    case "SET_DISCONNECTED":
      return state.map((m) =>
        m.id === action.assistantId
          ? { ...m, isStreaming: false, statusText: "⚠ Connection lost — partial response saved." }
          : m
      );
    case "CLEAR_MESSAGES":
      return [];
    case "LOAD_MESSAGES":
      return action.messages;
    default:
      return state;
  }
}

export function useChat(
  conversationId: string | undefined,
  activeAgentId?: string | null,
  onConvUpdate?: (convId: string, title: string) => void,
) {
  const [messages, dispatch] = useReducer(reducer, []);
  const { stream, stop, getPartialRecovery } = useSSE();
  const isStreamingRef = useRef(false);
  const { isAuthenticated } = useAuth();

  const sendMessage = useCallback(async (
    content: string,
    modelPreference: "auto" | "speed" | "quality" = "auto",
    tools: string[] = [],
    attachments: AttachmentRef[] = [],
    provider?: string,
    model?: string,
  ) => {
    if (isStreamingRef.current) return;
    isStreamingRef.current = true;

    const userMsgId = uuidv4();
    dispatch({
      type: "ADD_MESSAGE",
      message: { id: userMsgId, role: "user", content, attachments: attachments.length ? attachments : undefined },
    });

    const assistantId = uuidv4();
    dispatch({ type: "START_STREAMING", assistantId });

    const body: ChatRequest = {
      conversation_id: conversationId,
      model_preference: modelPreference,
      messages: [{ role: "user", content, attachments: attachments.length ? attachments : undefined }],
      tools,
      stream: true,
      agent_id: activeAgentId ?? undefined,
    };

    if (!isAuthenticated) {
      const gs = loadGuestSettings();
      const gProvider = gs.preferredProvider;
      const gModel = resolveModel(gs, gProvider);
      const apiKey = gs.apiKeys[gProvider] ?? "";

      body.provider = gProvider || undefined;
      body.model = gModel || undefined;
      if (apiKey) body.api_key = apiKey;
    } else if (provider || model) {
      body.provider = provider;
      body.model = model;
    }

    await stream(body, {
      onStatus: (text) => dispatch({ type: "SET_STATUS", assistantId, status: text }),
      onCitations: (citations) => dispatch({ type: "SET_CITATIONS", assistantId, citations }),
      onDelta: (delta) => dispatch({ type: "APPEND_DELTA", assistantId, delta }),
      onDone: (_usage, provider, model) =>
        dispatch({ type: "FINISH_STREAMING", assistantId, provider, model }),
      onError: (msg) =>
        dispatch({ type: "FINISH_STREAMING", assistantId, provider: "", model: msg }),
      onDisconnect: () => dispatch({ type: "SET_DISCONNECTED", assistantId }),
      onConvUpdate: (convId, title) => onConvUpdate?.(convId, title),
    });

    isStreamingRef.current = false;
  }, [conversationId, stream, isAuthenticated, activeAgentId]);

  const clearMessages = useCallback(() => dispatch({ type: "CLEAR_MESSAGES" }), []);
  const isStreaming = () => isStreamingRef.current;
  const partialRecovery = getPartialRecovery;

  const loadHistory = useCallback(async (convId: string) => {
    try {
      const history = await fetchConversationMessages(convId);
      const mapped: Message[] = history.map((m) => ({
        id: m.id,
        role: m.role as Message["role"],
        content: m.content,
        attachments: m.metadata?.attachments ?? undefined,
        metadata: m.metadata
          ? { provider: m.metadata.provider, model: m.metadata.model }
          : undefined,
      }));
      dispatch({ type: "LOAD_MESSAGES", messages: mapped });
    } catch {
      // silently fail — user still sees empty chat
    }
  }, []);

  return { messages, sendMessage, stop, clearMessages, loadHistory, isStreaming, partialRecovery };
}
