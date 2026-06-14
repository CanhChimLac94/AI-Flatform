"use client";

import { SparklesIcon } from "@heroicons/react/24/outline";
import {
  AGENT_ICON_OPTIONS,
  getAgentIconComponent,
  type AgentIconKey,
} from "@/lib/agentIcons";
import { useI18n } from "@/contexts/I18nContext";

interface IconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
  label?: string;
}

export function IconPicker({ value, onChange, label }: IconPickerProps) {
  const { t } = useI18n();
  const selected = value as AgentIconKey | null;
  const displayLabel = label ?? t("agents.iconPicker.label", "Icon");
  const selectedOption = value
    ? AGENT_ICON_OPTIONS.find((o) => o.key === value)
    : null;

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{displayLabel}</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          title={t("agents.iconPicker.autoTitle", "System default")}
          className={`flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border text-[10px] transition-colors ${
            value === null
              ? "bg-accent/20 border-accent text-white"
              : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400"
          }`}
        >
          <SparklesIcon className="w-5 h-5 opacity-70" />
          {t("agents.iconPicker.auto", "Auto")}
        </button>
        {AGENT_ICON_OPTIONS.map((opt) => {
          const Icon = getAgentIconComponent(opt.key);
          const active = selected === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              title={opt.label}
              className={`flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border text-[10px] transition-colors ${
                active
                  ? "bg-accent/20 border-accent text-white"
                  : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-[52px]">{opt.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 mt-1.5">
        {selectedOption
          ? t("agents.iconPicker.selected", "Selected: {name}", { name: selectedOption.label })
          : t("agents.iconPicker.autoHint", "System picks an icon from category or agent name")}
      </p>
    </div>
  );
}
