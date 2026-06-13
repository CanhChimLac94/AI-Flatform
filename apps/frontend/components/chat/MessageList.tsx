"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { useI18n } from "@/contexts/I18nContext";

interface MessageListProps {
  messages: Message[];
  onRegenerate?: (messageId: string) => void;
}

export function MessageList({ messages, onRegenerate }: MessageListProps) {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new content streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
        <div className="text-5xl">✨</div>
        <h2 className="text-xl font-semibold text-gray-200">{t("chat.emptyTitle")}</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          {t("chat.emptySubtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onRegenerate={onRegenerate ? () => onRegenerate(msg.id) : undefined}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
