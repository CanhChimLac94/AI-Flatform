"use client";

import { useCallback, useRef, useState } from "react";
import { PaperAirplaneIcon, StopIcon } from "@heroicons/react/24/solid";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import type { Attachment, AttachmentRef } from "@/lib/types";
import { uploadFile } from "@/lib/api";
import { AttachmentButton } from "./AttachmentButton";
import { VoiceButton } from "./VoiceButton";

const MAX_CHARS = 4000;

type ModelPref = "auto" | "speed" | "quality";

interface SmartInputBarProps {
  onSend: (content: string, model: ModelPref, tools: string[], attachments: AttachmentRef[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function SmartInputBar({ onSend, onStop, isStreaming, disabled }: SmartInputBarProps) {
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
        alert(`File upload error: ${msg}`);
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
    <div className="border-t border-gray-700 bg-chat-bg px-4 py-3">
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

      <div className="flex items-end gap-2 bg-input-bg rounded-2xl px-3 py-2 border border-gray-600 focus-within:border-accent transition-colors">
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
          placeholder="Message Omni AI…"
          disabled={isBusy}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-500 leading-relaxed py-1 max-h-[200px] overflow-y-auto"
        />

        {/* Right controls */}
        <div className="flex items-center gap-1 self-end pb-0.5 shrink-0">
          {/* Web search toggle */}
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            title="Toggle web search"
            className={`p-1.5 rounded-lg transition-colors ${
              webSearch ? "text-accent bg-indigo-900/40" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <GlobeAltIcon className="w-4 h-4" />
          </button>

          {/* Model preference selector */}
          <select
            value={modelPref}
            onChange={(e) => setModelPref(e.target.value as ModelPref)}
            className="text-xs bg-transparent text-gray-500 border-none outline-none cursor-pointer hover:text-gray-300"
          >
            <option value="auto">Auto</option>
            <option value="speed">⚡ Speed</option>
            <option value="quality">🧠 Quality</option>
          </select>

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
              title="Stop generating"
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
