"use client";

import { useState } from "react";
import type { AttachmentRef, Citation, Message } from "@/lib/types";
import { ActionButtons } from "./ActionButtons";
import { CitationPanel } from "./CitationPanel";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ClipboardIcon, CheckIcon, PaperClipIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function AttachmentChip({ att }: { att: AttachmentRef }) {
  if (isImage(att.content_type)) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" title={att.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.url}
          alt={att.name}
          className="max-h-48 max-w-xs rounded-xl object-cover border border-white/10 hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }
  return (
    <a
      href={att.url}
      download={att.name}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors max-w-[200px]"
      title={`Download ${att.name}`}
    >
      <PaperClipIcon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{att.name}</span>
      <ArrowDownTrayIcon className="w-3 h-3 shrink-0 opacity-60" />
    </a>
  );
}

export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const citations = message.citations ?? [];
  const attachments = message.attachments ?? [];

  const handleCopyUser = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
        <div className={`max-w-[78%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>

          {/* Status indicator (while streaming) */}
          {message.statusText && !message.content && (
            <p className="text-xs text-gray-500 italic px-1">{message.statusText}</p>
          )}

          {/* Attachments — shown above the bubble for user messages */}
          {isUser && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end">
              {attachments.map((att) => (
                <AttachmentChip key={att.id} att={att} />
              ))}
            </div>
          )}

          {/* Bubble */}
          {(message.content || message.isStreaming) && (
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                isUser
                  ? "bg-accent text-white rounded-br-sm whitespace-pre-wrap"
                  : "bg-gray-700 text-gray-100 rounded-bl-sm"
              }`}
            >
              {isUser ? (
                <span>{message.content}</span>
              ) : (
                <div className="prose-chat">
                  <MarkdownRenderer
                    content={message.content}
                    citations={citations}
                    onCitationClick={setOpenCitation}
                  />
                  {message.isStreaming && <span className="streaming-cursor" />}
                </div>
              )}
            </div>
          )}

          {/* Copy button for user messages — shown on hover */}
          {isUser && message.content && (
            <button
              onClick={handleCopyUser}
              className="self-end opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
              title="Copy"
            >
              {copied ? (
                <CheckIcon className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <ClipboardIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Action buttons — shown on hover after streaming completes */}
          {!isUser && !message.isStreaming && message.content && (
            <ActionButtons content={message.content} onRegenerate={onRegenerate} />
          )}

          {/* Provider badge */}
          {!isUser && message.metadata?.model && !message.isStreaming && (
            <span className="text-xs text-gray-600 px-1">
              via {message.metadata.model}
            </span>
          )}
        </div>
      </div>

      {/* Citation side panel */}
      {openCitation && (
        <div className="fixed inset-y-0 right-0 z-50 flex">
          <CitationPanel citation={openCitation} onClose={() => setOpenCitation(null)} />
        </div>
      )}
    </>
  );
}
