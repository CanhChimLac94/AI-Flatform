"use client";

import { useCallback, useEffect, useState } from "react";
import { XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import type { AgentFlowSummary, FlowRun } from "@/lib/types";
import { listFlowRuns, runFlowNow } from "@/lib/api";
import { useHasMounted } from "@/hooks/useHasMounted";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractOutputs(run: FlowRun): { label: string; value: string }[] {
  const result = run.result ?? {};
  const outputs = result.outputs;
  if (outputs && typeof outputs === "object" && !Array.isArray(outputs)) {
    return Object.entries(outputs as Record<string, unknown>).map(([label, value]) => ({
      label,
      value: String(value ?? ""),
    }));
  }
  const nodeOutputs = result.node_outputs;
  if (nodeOutputs && typeof nodeOutputs === "object" && !Array.isArray(nodeOutputs)) {
    return Object.entries(nodeOutputs as Record<string, unknown>).map(([label, value]) => ({
      label,
      value: String(value ?? ""),
    }));
  }
  return [];
}

const STATUS_LABEL: Record<string, string> = {
  success: "Thành công",
  failed: "Thất bại",
  running: "Đang chạy",
};

const STATUS_CLASS: Record<string, string> = {
  success: "text-emerald-400 bg-emerald-900/20 border-emerald-800/40",
  failed: "text-red-400 bg-red-900/20 border-red-800/40",
  running: "text-amber-400 bg-amber-900/20 border-amber-800/40",
};

interface Props {
  flow: AgentFlowSummary;
  highlightRunId?: string;
  onClose: () => void;
  onRan?: () => void;
}

export function FlowRunResultsModal({ flow, highlightRunId, onClose, onRan }: Props) {
  const mounted = useHasMounted();
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(highlightRunId ?? null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listFlowRuns(flow.id);
      setRuns(list);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử chạy");
    } finally {
      setLoading(false);
    }
  }, [flow.id]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (highlightRunId) setSelectedId(highlightRunId);
  }, [highlightRunId]);

  const selected = runs.find((r) => r.id === selectedId) ?? runs[0] ?? null;

  const handleRunNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const run = await runFlowNow(flow.id);
      await loadRuns();
      setSelectedId(run.id);
      onRan?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Chạy flow thất bại");
    } finally {
      setRunning(false);
    }
  };

  const outputItems = selected ? extractOutputs(selected) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Kết quả chạy flow</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{flow.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleRunNow()}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-700/50 hover:border-emerald-500 rounded-lg disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Đang chạy..." : "Chạy ngay"}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
          <div className="sm:w-48 border-b sm:border-b-0 sm:border-r border-gray-800 overflow-y-auto shrink-0 max-h-40 sm:max-h-none">
            {loading ? (
              <p className="p-4 text-xs text-gray-500">Đang tải...</p>
            ) : runs.length === 0 ? (
              <p className="p-4 text-xs text-gray-500">Chưa có lần chạy nào.</p>
            ) : (
              <ul className="py-2">
                {runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(run.id)}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                        selected?.id === run.id
                          ? "bg-indigo-900/30 text-indigo-200"
                          : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                      }`}
                    >
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium mb-1 ${STATUS_CLASS[run.status] ?? "text-gray-400"}`}>
                        {STATUS_LABEL[run.status] ?? run.status}
                      </span>
                      <span className="block" suppressHydrationWarning>
                        {mounted ? formatWhen(run.started_at) : "—"}
                      </span>
                      <span className="block text-[10px] text-gray-600 mt-0.5">
                        {run.trigger === "manual" ? "Thủ công" : "Lịch"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            {!selected && !loading ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Chưa có kết quả. Bấm &quot;Chạy ngay&quot; để thực thi flow.
              </p>
            ) : selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full border ${STATUS_CLASS[selected.status] ?? ""}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                  {selected.finished_at && mounted && (
                    <span className="text-gray-500" suppressHydrationWarning>
                      Hoàn tất: {formatWhen(selected.finished_at)}
                    </span>
                  )}
                </div>

                {selected.error_message && (
                  <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2 font-mono whitespace-pre-wrap">
                    {selected.error_message}
                  </div>
                )}

                {selected.status === "success" && outputItems.length === 0 && (
                  <p className="text-sm text-gray-500">Flow chạy xong nhưng không có output node.</p>
                )}

                {outputItems.map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</h3>
                    <pre className="text-xs text-green-200/90 bg-black/40 border border-gray-700 rounded-xl p-3 whitespace-pre-wrap break-words font-mono max-h-64 overflow-y-auto">
                      {value || "(trống)"}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
