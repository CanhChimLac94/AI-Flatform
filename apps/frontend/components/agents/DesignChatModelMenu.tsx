"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { displayModelLabel, groupDisplayName } from "@/lib/providerModelCatalog";
import { getProviderVisual } from "@/lib/providerVisuals";
import type { ProviderModelGroup } from "@/lib/types";
import { useI18n } from "@/contexts/I18nContext";

interface Props {
  groups: ProviderModelGroup[];
  selectedProvider: string;
  selectedModel: string;
  onChange: (modelId: string, provider?: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function DesignChatModelMenu({
  groups,
  selectedProvider,
  selectedModel,
  onChange,
  loading = false,
  disabled = false,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const providerVisual = selectedProvider ? getProviderVisual(selectedProvider) : null;

  const triggerLabel = [providerVisual?.name, selectedModel].filter(Boolean).join(" · ");

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

  const pickModel = (modelId: string, provider: string) => {
    onChange(modelId, provider);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("agents.designChat.llmLabel", "Design assistant LLM")}
        title={triggerLabel || t("agents.designChat.llmLabel", "Design assistant LLM")}
        className={`inline-flex items-center gap-1 max-w-[9rem] sm:max-w-[11rem] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? "text-violet-300 bg-violet-900/30 border border-violet-700/50"
            : "text-gray-500 hover:text-gray-300 border border-transparent hover:bg-gray-800/60"
        }`}
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4 shrink-0" />
        <span className="truncate hidden min-[400px]:inline">{triggerLabel || t("chat.model", "Model")}</span>
        <ChevronDownIcon className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("chat.model", "Model")}
          className="absolute bottom-full right-0 mb-2 w-[min(22rem,calc(100vw-2.5rem))] max-h-[min(50vh,18rem)] overflow-y-auto rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] py-1.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {loading ? (
            <p className="text-xs text-gray-500 px-3 py-2">{t("common.loading", "Loading...")}</p>
          ) : groups.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">
              {t(
                "agents.designChat.noModels",
                "No supported models available. Add an API key for Groq, OpenAI, OpenRouter, or NVIDIA.",
              )}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.provider} className="px-1.5">
                <p className="sticky top-0 z-10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-900">
                  {groupDisplayName(group)}
                </p>
                <ul className="space-y-0.5 pb-1">
                  {group.models.map((entry) => {
                    const isSelected =
                      group.provider === selectedProvider && entry.model_id === selectedModel;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => pickModel(entry.model_id, group.provider)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                            isSelected
                              ? "bg-violet-900/40 text-violet-200 border border-violet-700/40"
                              : "text-gray-300 hover:bg-gray-800 border border-transparent"
                          }`}
                        >
                          <span className="flex-1 min-w-0 truncate font-mono">
                            {displayModelLabel(entry)}
                          </span>
                          {isSelected && <CheckIcon className="w-4 h-4 shrink-0 text-violet-400" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
