"use client";

import { useCallback, useRef, useState } from "react";
import { PaperAirplaneIcon, StopIcon } from "@heroicons/react/24/solid";
import type { Agent, Attachment, AttachmentRef, SystemAgent } from "@/lib/types";
import { uploadFile } from "@/lib/api";
import { AttachmentButton } from "./AttachmentButton";
import { VoiceButton } from "./VoiceButton";
import { ChatOptionsMenu, type ModelPref } from "@/components/chat/ChatOptionsMenu";
import { useI18n } from "@/contexts/I18nContext";

const MAX_CHARS = 4000;

interface SmartInputBarProps {
  onSend: (content: string, model: ModelPref, tools: string[], attachments: AttachmentRef[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  agents?: Agent[];
  systemAgents?: SystemAgent[];
  activeAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  selectedProvider?: string;
  selectedModel?: string;
  onProviderChange?: (v: string) => void;
  onModelChange?: (v: string) => void;
  optionsDisabled?: boolean;
}

export function SmartInputBar({
  onSend,
  onStop,
  isStreaming,
  disabled,
  agents = [],
  systemAgents = [],
  activeAgentId = null,
  onSelectAgent,
  selectedProvider = "",
  selectedModel = "",
  onProviderChange,
  onModelChange,
  optionsDisabled = false,
}: SmartInputBarProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modelPref, setModelPref] = useState<ModelPref>("auto");
  const [webSearch, setWebSearch] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const content = value.trim();
    if (!content || isStreaming || isSending) return;

    setIsSending(true);
    const tools = webSearch ? ["web_search"] : [];

    let refs: AttachmentRef[] = [];
    if (attachments.length > 0) {
      // Mark all as uploading
      setAttachments((prev) => prev.map((a) => ({ ...a, uploading: true })));
      try {
        refs = await Promise.all(attachments.map((a) => uploadFile(a.file)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        alert(t("chat.uploadFailed", "File upload error: {message}", { message: msg }));
        setAttachments((prev) => prev.map((a) => ({ ...a, uploading: false })));
        setIsSending(false);
        return;
      }
    }

    onSend(content, modelPref, tools, refs);
    setValue("");
    setAttachments([]);
    setIsSending(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, isStreaming, isSending, webSearch, attachments, modelPref, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charsLeft = MAX_CHARS - value.length;
  const isBusy = disabled || isStreaming || isSending;

  return (
    <div className="border-t border-gray-700 bg-chat-bg px-3 sm:px-4 py-3 safe-area-bottom">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mb-2">
          <AttachmentButton
            attachments={attachments}
            onChange={setAttachments}
            disabled={isBusy}
          />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 bg-input-bg rounded-2xl px-2 sm:px-3 py-2 border border-gray-600 focus-within:border-accent transition-colors">
        {/* Attachment icon */}
        <div className="self-end pb-0.5">
          <AttachmentButton
            attachments={[]}
            onChange={(f) => setAttachments((p) => [...p, ...f])}
            disabled={isBusy || attachments.length >= 5}
          />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value.slice(0, MAX_CHARS)); autoResize(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t("chat.inputPlaceholder")}
          disabled={isBusy}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-500 leading-relaxed py-1 max-h-[200px] overflow-y-auto"
        />

        {/* Right controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 self-end pb-0.5 shrink-0 flex-wrap justify-end">
          {onProviderChange && onModelChange && onSelectAgent && (
            <ChatOptionsMenu
              modelPref={modelPref}
              onModelPrefChange={setModelPref}
              webSearch={webSearch}
              onWebSearchChange={setWebSearch}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={onProviderChange}
              onModelChange={onModelChange}
              agents={agents}
              systemAgents={systemAgents}
              activeAgentId={activeAgentId}
              onSelectAgent={onSelectAgent}
              disabled={optionsDisabled || isBusy}
            />
          )}

          {/* Voice button */}
          <VoiceButton
            onTranscript={(t) => setValue((v) => (v + " " + t).trim())}
            disabled={isBusy}
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              title={t("chat.stopGenerating")}
            >
              <StopIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || isBusy}
              className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={isSending ? "Uploading…" : "Send (Enter)"}
            >
              {isSending ? (
                <span className="w-4 h-4 block border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Char counter */}
      {value.length > MAX_CHARS * 0.8 && (
        <p className={`text-xs mt-1 text-right ${charsLeft < 100 ? "text-red-400" : "text-gray-500"}`}>
          {charsLeft} characters left
        </p>
      )}
    </div>
  );
}
