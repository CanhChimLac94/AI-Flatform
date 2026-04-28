"use client";

// US01 AC2: Upload up to 5 files (JPG, PNG, PDF, DOCX, XLSX) up to 20MB each.
// US01 AC4: Shows "Uploading…" state for files > 5MB.

import { useRef, useState } from "react";
import { PaperClipIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Attachment } from "@/lib/types";

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 20 * 1024 * 1024;  // 20MB (AiChat-UIUX-Wireframe §IV R01)
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;
const ACCEPTED = ".jpg,.jpeg,.png,.pdf,.docx,.xlsx";

interface AttachmentButtonProps {
  attachments: Attachment[];
  onChange: (files: Attachment[]) => void;
  disabled?: boolean;
}

export function AttachmentButton({ attachments, onChange, disabled }: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).slice(0, MAX_FILES - attachments.length);
    const valid: Attachment[] = [];

    for (const file of incoming) {
      if (file.size > MAX_SIZE_BYTES) {
        alert(`"${file.name}" exceeds 20MB limit.`);
        continue;
      }
      valid.push({
        file,
        uploading: file.size > LARGE_FILE_THRESHOLD,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      });
    }

    onChange([...attachments, ...valid]);
  };

  const remove = (index: number) => {
    const next = attachments.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || attachments.length >= MAX_FILES}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
        title="Attach files"
      >
        <PaperClipIcon className="w-5 h-5" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Attachment preview chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map((att, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-lg text-xs text-gray-300 max-w-[140px]"
            >
              {att.preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.preview} alt="" className="w-4 h-4 rounded object-cover" />
              )}
              <span className="truncate">
                {att.uploading ? `Uploading…` : att.file.name}
              </span>
              <button onClick={() => remove(i)} className="text-gray-500 hover:text-red-400">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
