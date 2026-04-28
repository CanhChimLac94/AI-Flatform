"use client";

import { useCallback, useRef } from "react";
import type { Citation, SSEEvent } from "@/lib/types";
import { buildChatStream } from "@/lib/api";
import type { ChatRequest } from "@/lib/types";

const PARTIAL_KEY = "omni_partial_response";

interface SSECallbacks {
  onStatus: (text: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDelta: (delta: string) => void;
  onDone: (usage: SSEEvent["usage"], provider: string, model: string) => void;
  onError: (msg: string) => void;
  onDisconnect: () => void;
  onConvUpdate?: (convId: string, title: string) => void;
}

export function useSSE() {
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (body: ChatRequest, callbacks: SSECallbacks) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const { url, init } = buildChatStream(body);
    let partialContent = "";

    const savePartial = () => {
      if (partialContent) localStorage.setItem(PARTIAL_KEY, partialContent);
    };

    try {
      const response = await fetch(url, { ...init, signal: abortRef.current.signal });
      if (!response.ok) {
        // Read structured error from body when available
        const body = await response.json().catch(() => ({}));
        const msg: string = body.message ?? body.detail ?? `Server error ${response.status}`;
        callbacks.onError(msg);
        return;
      }
      if (!response.body) {
        callbacks.onError("No response body");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SSEEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              callbacks.onStatus(event.content ?? "");
              break;
            case "citations":
              callbacks.onCitations(event.links ?? []);
              break;
            case "content":
              partialContent += event.delta ?? "";
              savePartial();
              callbacks.onDelta(event.delta ?? "");
              break;
            case "done":
              localStorage.removeItem(PARTIAL_KEY);
              callbacks.onDone(
                event.usage,
                event.usage?.provider ?? "",
                event.usage?.model ?? ""
              );
              break;
            case "error":
              callbacks.onError(event.message ?? "Unknown error");
              break;
            case "conv_update":
              if (event.conv_id && event.title !== undefined) {
                callbacks.onConvUpdate?.(event.conv_id, event.title ?? "");
              }
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // EX-04: save partial to LocalStorage on disconnect
      savePartial();
      callbacks.onDisconnect();
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // EX-04: recover partial response saved before disconnect
  const getPartialRecovery = useCallback((): string | null => {
    return localStorage.getItem(PARTIAL_KEY);
  }, []);

  return { stream, stop, getPartialRecovery };
}
