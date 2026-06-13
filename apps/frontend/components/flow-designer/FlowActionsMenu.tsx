"use client";

import { useEffect, useRef, useState } from "react";
import { Cog6ToothIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/contexts/I18nContext";
import type { FlowAutoSaveSettings } from "@/lib/flowAutoSaveSettings";
import { FlowAutoSaveSettingsPanel } from "./FlowAutoSaveSettingsPanel";
import { FlowIcon } from "./flowIcons";

interface FlowActionsMenuProps {
  disabled?: boolean;
  outputCount?: number;
  autoSaveSettings: FlowAutoSaveSettings;
  onAutoSaveSettingsChange: (next: FlowAutoSaveSettings) => void;
  onImport: () => void;
  onExport: () => void;
  onExportOutputs?: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: "green";
}) {
  const accentClass =
    accent === "green"
      ? "text-green-700 dark:text-green-300 hover:bg-green-500/10 dark:hover:bg-green-900/20"
      : "text-muted hover:bg-surface-hover hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 ${accentClass}`}
    >
      <span className="w-4 h-4 shrink-0 flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function FlowActionsMenu({
  disabled = false,
  outputCount = 0,
  autoSaveSettings,
  onAutoSaveSettingsChange,
  onImport,
  onExport,
  onExportOutputs,
}: FlowActionsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeAnd = (fn: () => void) => {
    setOpen(false);
    setSettingsOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("flows.menuSettings")}
        className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
          open
            ? "bg-input-bg border-border text-foreground"
            : "bg-input-bg border-border text-muted hover:text-foreground hover:bg-surface-hover"
        }`}
      >
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 w-56 py-1 rounded-xl bg-surface border border-border shadow-2xl"
        >
          <MenuItem
            icon={<FlowIcon icon="upload" className="w-4 h-4" />}
            label="Import JSON"
            disabled={disabled}
            onClick={() => closeAnd(onImport)}
          />
          <MenuItem
            icon={<FlowIcon icon="download" className="w-4 h-4" />}
            label="Export JSON"
            disabled={disabled}
            onClick={() => closeAnd(onExport)}
          />
          {outputCount > 0 && onExportOutputs && (
            <>
              <div className="border-t border-border my-1" />
              <MenuItem
                icon={<FlowIcon icon="save" className="w-4 h-4" />}
                label={`Xuất kết quả (${outputCount})`}
                accent="green"
                onClick={() => closeAnd(onExportOutputs)}
              />
            </>
          )}

          <div className="border-t border-border my-1" />

          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
              settingsOpen
                ? "bg-surface-elevated text-foreground"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Cog6ToothIcon className="w-4 h-4 shrink-0" />
              {t("flows.menuSettings")}
            </span>
            <span className="text-[10px] text-muted">{settingsOpen ? "▾" : "▸"}</span>
          </button>

          {settingsOpen && (
            <FlowAutoSaveSettingsPanel
              settings={autoSaveSettings}
              onChange={onAutoSaveSettingsChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
