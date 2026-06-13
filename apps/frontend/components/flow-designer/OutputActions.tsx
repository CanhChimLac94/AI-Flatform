"use client";

import { useState } from "react";
import {
  copyOutputToClipboard,
  downloadOutputFile,
  EXPORT_FORMAT_OPTIONS,
  isExportableOutput,
  type OutputFileFormat,
} from "./outputExport";

interface OutputActionsProps {
  content?: string;
  label: string;
  preferredFormat?: OutputFileFormat;
  compact?: boolean;
}

export function OutputActions({ content = "", label, preferredFormat = "auto", compact = false }: OutputActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const canExport = isExportableOutput(content);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canExport) return;
    const ok = await copyOutputToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = (format: OutputFileFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canExport) return;
    const resolved = format === "auto" && preferredFormat !== "auto" ? preferredFormat : format;
    downloadOutputFile(content, label, resolved);
    setShowFormats(false);
  };

  const btnClass =
    "flex items-center justify-center rounded-lg border border-white/10 hover:border-green-500/40 hover:bg-green-500/10 text-white/50 hover:text-green-300 transition-all disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className={`flex items-center gap-1 ${compact ? "" : "relative"}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!canExport}
        title="Copy kết quả"
        className={`${btnClass} ${compact ? "w-7 h-7" : "gap-1 px-2 py-1"}`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {copied ? "check" : "content_copy"}
        </span>
        {!compact && (
          <span className="text-[9px] font-bold uppercase">{copied ? "Đã copy" : "Copy"}</span>
        )}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!canExport) return;
            setShowFormats((v) => !v);
          }}
          disabled={!canExport}
          title="Xuất file"
          className={`${btnClass} ${compact ? "w-7 h-7" : "gap-1 px-2 py-1"}`}
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          {!compact && <span className="text-[9px] font-bold uppercase">Xuất</span>}
        </button>

        {showFormats && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFormats(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl">
              {EXPORT_FORMAT_OPTIONS.map(({ value, label: fmtLabel, ext }) => (
                <button
                  key={value}
                  type="button"
                  onClick={(e) => handleExport(value, e)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[10px] text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span>{fmtLabel}</span>
                  <span className="text-white/25 uppercase">.{value === "auto" ? "auto" : ext}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
