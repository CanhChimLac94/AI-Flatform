export type FlowAutoSavePreset = "off" | "1m" | "3m" | "5m" | "custom";

export interface FlowAutoSaveSettings {
  preset: FlowAutoSavePreset;
  /** Used when preset is "custom"; clamped to 1–120 minutes. */
  customMinutes: number;
}

const STORAGE_KEY = "aichat.flow.autosave";

export const FLOW_AUTOSAVE_PRESETS: { id: FlowAutoSavePreset; minutes: number }[] = [
  { id: "off", minutes: 0 },
  { id: "1m", minutes: 1 },
  { id: "3m", minutes: 3 },
  { id: "5m", minutes: 5 },
];

const DEFAULT_SETTINGS: FlowAutoSaveSettings = {
  preset: "off",
  customMinutes: 10,
};

export function clampCustomMinutes(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(120, Math.max(1, Math.round(value)));
}

export function intervalMsFromSettings(settings: FlowAutoSaveSettings): number {
  if (settings.preset === "off") return 0;
  if (settings.preset === "custom") {
    return clampCustomMinutes(settings.customMinutes) * 60_000;
  }
  const preset = FLOW_AUTOSAVE_PRESETS.find((p) => p.id === settings.preset);
  return (preset?.minutes ?? 0) * 60_000;
}

export function isAutoSaveEnabled(settings: FlowAutoSaveSettings): boolean {
  return intervalMsFromSettings(settings) > 0;
}

export function loadFlowAutoSaveSettings(): FlowAutoSaveSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<FlowAutoSaveSettings>;
    const preset = parsed.preset;
    const validPreset: FlowAutoSavePreset =
      preset === "off" || preset === "1m" || preset === "3m" || preset === "5m" || preset === "custom"
        ? preset
        : DEFAULT_SETTINGS.preset;
    return {
      preset: validPreset,
      customMinutes: clampCustomMinutes(parsed.customMinutes ?? DEFAULT_SETTINGS.customMinutes),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveFlowAutoSaveSettings(settings: FlowAutoSaveSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      preset: settings.preset,
      customMinutes: clampCustomMinutes(settings.customMinutes),
    }),
  );
}

export function formatAutoSaveInterval(settings: FlowAutoSaveSettings, locale: string): string {
  const ms = intervalMsFromSettings(settings);
  if (ms <= 0) return "";
  const minutes = ms / 60_000;
  if (locale.startsWith("vi")) {
    return `${minutes} phút`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
