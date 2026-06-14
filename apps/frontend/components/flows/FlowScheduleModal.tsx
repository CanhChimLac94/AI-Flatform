"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { FlowFrequency, FlowSchedule, FlowScheduleUpsertRequest } from "@/lib/types";
import {
  deleteFlowSchedule,
  getFlowSchedule,
  runFlowNow,
  upsertFlowSchedule,
} from "@/lib/api";
import { useI18n } from "@/contexts/I18nContext";

function toLocalDatetimeValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  flowId: string;
  flowName: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function FlowScheduleModal({ flowId, flowName, onClose, onUpdated }: Props) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<FlowSchedule | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<FlowFrequency>("daily");
  const [runAtLocal, setRunAtLocal] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [timezone] = useState("Asia/Ho_Chi_Minh");

  const frequencyOptions = useMemo(
    () =>
      [
        { value: "once" as const, label: t("flows.scheduleModal.freqOnce", "Once") },
        { value: "hourly" as const, label: t("flows.scheduleModal.freqHourly", "Hourly") },
        { value: "daily" as const, label: t("flows.scheduleModal.freqDaily", "Daily") },
        { value: "weekly" as const, label: t("flows.scheduleModal.freqWeekly", "Weekly") },
      ],
    [t],
  );

  const weekdays = useMemo(
    () =>
      [
        { value: 0, label: t("flows.scheduleModal.weekMon", "Monday") },
        { value: 1, label: t("flows.scheduleModal.weekTue", "Tuesday") },
        { value: 2, label: t("flows.scheduleModal.weekWed", "Wednesday") },
        { value: 3, label: t("flows.scheduleModal.weekThu", "Thursday") },
        { value: 4, label: t("flows.scheduleModal.weekFri", "Friday") },
        { value: 5, label: t("flows.scheduleModal.weekSat", "Saturday") },
        { value: 6, label: t("flows.scheduleModal.weekSun", "Sunday") },
      ],
    [t],
  );

  const formatScheduleSummary = (schedule: FlowSchedule | null): string => {
    if (!schedule?.enabled) return t("flows.scheduleModal.disabled", "No schedule enabled");
    if (schedule.next_run_at) {
      const time = new Date(schedule.next_run_at).toLocaleString(
        locale === "vi" ? "vi-VN" : "en-US",
      );
      return t("flows.scheduleModal.nextRun", "Next run: {time}", { time });
    }
    return t("flows.scheduleModal.enabledPending", "Schedule enabled — pending update");
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const schedule = await getFlowSchedule(flowId);
        setExisting(schedule);
        setEnabled(schedule.enabled);
        setFrequency(schedule.frequency);
        setRunAtLocal(toLocalDatetimeValue(schedule.run_at));
        setIntervalMinutes(schedule.interval_minutes ?? 60);
        setTimeOfDay(schedule.time_of_day ?? "09:00");
        setDayOfWeek(schedule.day_of_week ?? 0);
      } catch {
        setExisting(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [flowId]);

  const buildPayload = (): FlowScheduleUpsertRequest => {
    const payload: FlowScheduleUpsertRequest = {
      enabled,
      frequency,
      timezone,
    };
    if (frequency === "once") {
      payload.run_at = runAtLocal ? new Date(runAtLocal).toISOString() : undefined;
    }
    if (frequency === "hourly") {
      payload.interval_minutes = intervalMinutes;
    }
    if (frequency === "daily" || frequency === "weekly") {
      payload.time_of_day = timeOfDay;
    }
    if (frequency === "weekly") {
      payload.day_of_week = dayOfWeek;
    }
    return payload;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertFlowSchedule(flowId, buildPayload());
      setExisting(saved);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("flows.errors.saveScheduleFailed", "Failed to save schedule"));
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setError(null);
    try {
      await runFlowNow(flowId);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("flows.errors.runFailed", "Failed to run flow"));
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!existing) return;
    if (!window.confirm(t("flows.scheduleModal.deleteConfirm", "Remove the automatic schedule for this flow?"))) return;
    setSaving(true);
    setError(null);
    try {
      await deleteFlowSchedule(flowId);
      setExisting(null);
      setEnabled(false);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("flows.errors.deleteScheduleFailed", "Failed to delete schedule"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {t("flows.scheduleModal.title", "Schedule flow run")}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{flowName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800"
            aria-label={t("common.close", "Close")}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">{t("flows.scheduleModal.loading", "Loading schedule…")}</p>
          ) : (
            <>
              {existing && (
                <p className="text-xs text-indigo-300/80 bg-indigo-900/20 border border-indigo-800/40 rounded-lg px-3 py-2">
                  {formatScheduleSummary(existing)}
                  {existing.last_status && (
                    <span className="block mt-1 text-gray-400">
                      {t("flows.scheduleModal.lastRun", "Last run: {status}", {
                        status: existing.last_status,
                      })}
                      {existing.last_error ? ` — ${existing.last_error}` : ""}
                    </span>
                  )}
                </p>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-indigo-500"
                />
                <span className="text-sm text-gray-300">
                  {t("flows.scheduleModal.enableLabel", "Enable automatic schedule")}
                </span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-400">
                  {t("flows.scheduleModal.frequencyLabel", "Frequency")}
                </span>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as FlowFrequency)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                >
                  {frequencyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              {frequency === "once" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-gray-400">
                    {t("flows.scheduleModal.runAtLabel", "Run at")}
                  </span>
                  <input
                    type="datetime-local"
                    value={runAtLocal}
                    onChange={(e) => setRunAtLocal(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </label>
              )}

              {frequency === "hourly" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-gray-400">
                    {t("flows.scheduleModal.intervalMinutesLabel", "Every (minutes)")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10080}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </label>
              )}

              {(frequency === "daily" || frequency === "weekly") && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-gray-400">
                    {t("flows.scheduleModal.timeOfDayLabel", "Time (HH:MM)")}
                  </span>
                  <input
                    type="time"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </label>
              )}

              {frequency === "weekly" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-gray-400">
                    {t("flows.scheduleModal.dayOfWeekLabel", "Day of week")}
                  </span>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    {weekdays.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </label>
              )}

              <p className="text-[11px] text-gray-500">
                {t("flows.scheduleModal.timezoneLabel", "Timezone: {tz}", { tz: timezone })}
              </p>
            </>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-1 border-t border-gray-800">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleRunNow()}
                disabled={running || loading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-300 border border-emerald-700/50 hover:border-emerald-500 rounded-lg disabled:opacity-50"
              >
                <PlayIcon className="w-4 h-4" />
                {running ? t("flows.running", "Running…") : t("flows.runNow", "Run now")}
              </button>
              {existing && (
                <button
                  type="button"
                  onClick={() => void handleDeleteSchedule()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/20 disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                  {t("flows.scheduleModal.deleteSchedule", "Remove schedule")}
                </button>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg"
              >
                {saving ? t("flows.form.saving", "Saving…") : t("flows.scheduleModal.saveSchedule", "Save schedule")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
