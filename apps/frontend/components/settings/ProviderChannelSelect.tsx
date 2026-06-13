"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { getProviderVisual, listProviderVisuals } from "@/lib/providerVisuals";

interface Props {
  value: string;
  onChange: (providerId: string) => void;
  enabledCounts?: Record<string, number>;
  className?: string;
}

function ProviderBadge({
  providerId,
  providerName,
  enabledCount,
  compact,
}: {
  providerId: string;
  providerName?: string;
  enabledCount?: number;
  compact?: boolean;
}) {
  const visual = getProviderVisual(providerId, providerName);
  const Icon = visual.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border font-medium ${visual.badgeClass} ${
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${visual.dotClass}`} />
      <Icon className="w-4 h-4 shrink-0 opacity-90" />
      <span className="truncate">{visual.name}</span>
      {enabledCount !== undefined && (
        <span className="text-[10px] opacity-70 tabular-nums">{enabledCount} bật</span>
      )}
    </span>
  );
}

export function ProviderChannelSelect({ value, onChange, enabledCounts, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = listProviderVisuals();
  const selected = getProviderVisual(value);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chọn kênh provider"
        className={`w-full flex items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover ${
          open ? `ring-2 ${selected.selectedClass}` : "border-border hover:border-border"
        }`}
      >
        <ProviderBadge
          providerId={value}
          enabledCount={enabledCounts?.[value]}
        />
        <ChevronDownIcon
          className={`w-5 h-5 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Danh sách kênh"
          className="absolute z-50 left-0 right-0 mt-2 py-1.5 rounded-xl bg-surface border border-border shadow-2xl max-h-72 overflow-y-auto"
        >
          {options.map((opt) => {
            const isSelected = opt.id === value;
            const Icon = opt.icon;
            return (
              <li key={opt.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-surface-elevated" : "hover:bg-surface-hover"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 ${opt.panelClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{opt.name}</p>
                    <p className="text-[11px] text-muted font-mono">{opt.id}</p>
                  </div>
                  {enabledCounts?.[opt.id] !== undefined && (
                    <span className="text-[11px] text-muted tabular-nums shrink-0">
                      {enabledCounts[opt.id]} bật
                    </span>
                  )}
                  {isSelected && <CheckIcon className="w-4 h-4 text-blue-400 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
