"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/contexts/I18nContext";
import {
  type FlowAutoSavePreset,
  type FlowAutoSaveSettings,
  clampCustomMinutes,
  isAutoSaveEnabled,
} from "@/lib/flowAutoSaveSettings";

const PRESET_OPTIONS: { id: FlowAutoSavePreset; labelKey: string }[] = [
  { id: "off", labelKey: "flows.autoSaveOff" },
  { id: "1m", labelKey: "flows.autoSave1m" },
  { id: "3m", labelKey: "flows.autoSave3m" },
  { id: "5m", labelKey: "flows.autoSave5m" },
  { id: "custom", labelKey: "flows.autoSaveCustom" },
];

interface FlowAutoSaveSettingsPanelProps {
  settings: FlowAutoSaveSettings;
  onChange: (next: FlowAutoSaveSettings) => void;
}

export function FlowAutoSaveSettingsPanel({ settings, onChange }: FlowAutoSaveSettingsPanelProps) {
  const { t } = useI18n();

  return (
    <div className="px-3 py-2 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {t("flows.autoSaveTitle")}
      </p>
      <div className="space-y-0.5" role="radiogroup" aria-label={t("flows.autoSaveTitle")}>
        {PRESET_OPTIONS.map((opt) => {
          const selected = settings.preset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ ...settings, preset: opt.id })}
              className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                selected
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              <span>{t(opt.labelKey)}</span>
              {selected && <CheckIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {settings.preset === "custom" && (
        <div className="pt-1">
          <label className="block text-[10px] text-muted mb-1" htmlFor="flow-autosave-custom-minutes">
            {t("flows.autoSaveCustomMinutes")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="flow-autosave-custom-minutes"
              type="number"
              min={1}
              max={120}
              value={settings.customMinutes}
              onChange={(e) =>
                onChange({
                  ...settings,
                  customMinutes: clampCustomMinutes(Number(e.target.value)),
                })
              }
              className="w-16 bg-input-bg border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-indigo-500/50"
            />
            <span className="text-[10px] text-muted">{t("flows.autoSaveMinutesUnit")}</span>
          </div>
        </div>
      )}

      {isAutoSaveEnabled(settings) && (
        <p className="text-[10px] text-muted leading-relaxed">
          {t("flows.autoSaveHint")}
        </p>
      )}
    </div>
  );
}
