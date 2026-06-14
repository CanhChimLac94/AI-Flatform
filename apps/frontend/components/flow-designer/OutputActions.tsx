"use client";

import { useState } from "react";
import {
  copyOutputToClipboard,
  downloadOutputFile,
  EXPORT_FORMAT_VALUES,
  isExportableOutput,
  type OutputFileFormat,
} from "./outputExport";
import { FlowIcon } from "./flowIcons";
import { useI18n } from "@/contexts/I18nContext";

interface OutputActionsProps {
  content?: string;
  label: string;
  preferredFormat?: OutputFileFormat;
  compact?: boolean;
}

export function OutputActions({ content = "", label, preferredFormat = "auto", compact = false }: OutputActionsProps) {
  const { t } = useI18n();
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
    "flex items-center justify-center rounded-lg border border-border hover:border-green-600/40 dark:hover:border-green-500/40 hover:bg-green-500/10 text-muted hover:text-green-700 dark:hover:text-green-400 transition-all disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className={`flex items-center gap-1 ${compact ? "" : "relative"}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!canExport}
        title={t("flows.outputActions.copyTitle", "Copy result")}
        className={`${btnClass} ${compact ? "w-7 h-7" : "gap-1 px-2 py-1"}`}
      >
        <FlowIcon icon={copied ? "check" : "copy"} className="w-4 h-4" />
        {!compact && (
          <span className="text-[9px] font-bold uppercase">
            {copied ? t("flows.outputActions.copied", "Copied") : t("flows.outputActions.copy", "Copy")}
          </span>
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
          title={t("flows.outputActions.exportTitle", "Export file")}
          className={`${btnClass} ${compact ? "w-7 h-7" : "gap-1 px-2 py-1"}`}
        >
          <FlowIcon icon="download" className="w-4 h-4" />
          {!compact && (
            <span className="text-[9px] font-bold uppercase">
              {t("flows.outputActions.export", "Export")}
            </span>
          )}
        </button>

        {showFormats && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFormats(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1 rounded-xl bg-surface border border-border shadow-2xl">
              {EXPORT_FORMAT_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={(e) => handleExport(value, e)}
                  className="w-full px-3 py-1.5 text-left text-[11px] text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
                >
                  {t(`flows.exportFormats.${value}`, value.toUpperCase())}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
