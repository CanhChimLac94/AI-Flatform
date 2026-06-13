"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface FlowMetaEditorProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  disabled?: boolean;
  autoFocusName?: boolean;
  /** Rendered on the same row as the name field (e.g. status badges). */
  status?: React.ReactNode;
}

export function FlowMetaEditor({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  expanded,
  onExpandedChange,
  disabled = false,
  autoFocusName = false,
  status,
}: FlowMetaEditorProps) {
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusName && !disabled && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [autoFocusName, disabled]);

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5 min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          placeholder="Tên flow"
          className="min-w-[7rem] max-w-[10rem] sm:max-w-[14rem] flex-1 px-2.5 py-1.5 rounded-lg bg-input-bg border border-border text-foreground text-[11px] sm:text-xs font-medium placeholder:text-muted outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          disabled={disabled}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-input-bg border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
          title={expanded ? "Thu gọn mô tả" : "Sửa mô tả"}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </button>
        {status}
      </div>

      {expanded && (
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Mô tả ngắn về mục đích của flow..."
          className="w-full px-2.5 py-2 rounded-lg bg-input-bg border border-border text-foreground text-[11px] sm:text-xs placeholder:text-muted outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none disabled:opacity-50"
        />
      )}
    </div>
  );
}
