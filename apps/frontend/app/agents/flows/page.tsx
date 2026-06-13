"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { AgentFlowSummary, FlowCreateRequest, FlowUpdateRequest } from "@/lib/types";
import { FlowCard } from "@/components/flows/FlowCard";
import { FlowForm } from "@/components/flows/FlowForm";
import { FlowScheduleModal } from "@/components/flows/FlowScheduleModal";
import { FlowRunResultsModal } from "@/components/flows/FlowRunResultsModal";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  listFlows, createFlow, updateFlow, deleteFlow, duplicateFlow, runFlowNow,
} from "@/lib/api";
import {
  loadGuestFlowSummaries, createGuestFlow, updateGuestFlow,
  deleteGuestFlow, duplicateGuestFlow,
} from "@/lib/flowStore";

type FormMode =
  | { type: "create" }
  | { type: "edit"; flow: AgentFlowSummary }
  | null;

type ScheduleMode = { flow: AgentFlowSummary } | null;

type ResultsMode = {
  flow: AgentFlowSummary;
  highlightRunId?: string;
} | null;

const EMPTY_GRAPH = { nodes: [], edges: [], version: "1.0" };

export default function FlowsManagePage() {
  const router = useRouter();
  const { isAuthenticated, isAuthReady } = useAuth();
  const [flows, setFlows] = useState<AgentFlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(null);
  const [resultsMode, setResultsMode] = useState<ResultsMode>(null);
  const [runningFlowId, setRunningFlowId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AgentFlowSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        setFlows(await listFlows());
      } else {
        setFlows(loadGuestFlowSummaries());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách flow");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthReady) return;
    void load();
  }, [load, isAuthReady]);

  const handleCreate = useCallback(async (data: FlowCreateRequest | FlowUpdateRequest) => {
    const payload = data as FlowCreateRequest;
    if (isAuthenticated) {
      const created = await createFlow({
        name: payload.name,
        description: payload.description,
        graph: EMPTY_GRAPH,
      });
      router.push(`/agents/flow/${created.id}`);
      return;
    }
    const created = createGuestFlow({
      name: payload.name,
      description: payload.description,
      graph: EMPTY_GRAPH,
    });
    router.push(`/agents/flow/${created.id}`);
  }, [isAuthenticated, router]);

  const handleEditMeta = useCallback(async (data: FlowCreateRequest | FlowUpdateRequest) => {
    if (formMode?.type !== "edit") return;
    const id = formMode.flow.id;
    const payload = data as FlowUpdateRequest;

    if (isAuthenticated) {
      const updated = await updateFlow(id, payload);
      setFlows((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                name: updated.name,
                description: updated.description,
                updated_at: updated.updated_at,
              }
            : f,
        ),
      );
    } else {
      const updated = updateGuestFlow(id, payload);
      if (updated) {
        setFlows((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  name: updated.name,
                  description: updated.description,
                  updated_at: updated.updated_at,
                }
              : f,
          ),
        );
      }
    }
    setFormMode(null);
  }, [formMode, isAuthenticated]);

  const handleDuplicate = useCallback(async (flow: AgentFlowSummary) => {
    try {
      if (isAuthenticated) {
        const copy = await duplicateFlow(flow.id);
        setFlows((prev) => [
          {
            id: copy.id,
            owner_user_id: copy.owner_user_id,
            name: copy.name,
            description: copy.description,
            node_count: copy.node_count,
            edge_count: copy.edge_count,
            created_at: copy.created_at,
            updated_at: copy.updated_at,
          },
          ...prev,
        ]);
      } else {
        const copy = duplicateGuestFlow(flow.id);
        if (copy) {
          setFlows((prev) => [
            {
              id: copy.id,
              owner_user_id: copy.owner_user_id,
              name: copy.name,
              description: copy.description,
              node_count: copy.node_count,
              edge_count: copy.edge_count,
              created_at: copy.created_at,
              updated_at: copy.updated_at,
            },
            ...prev,
          ]);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nhân bản thất bại");
    }
  }, [isAuthenticated]);

  const handleDelete = useCallback(async (flow: AgentFlowSummary) => {
    try {
      if (isAuthenticated) {
        await deleteFlow(flow.id);
      } else {
        deleteGuestFlow(flow.id);
      }
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Xóa thất bại");
    } finally {
      setDeleteConfirm(null);
    }
  }, [isAuthenticated]);

  const handleRun = useCallback(async (flow: AgentFlowSummary) => {
    if (!isAuthenticated) return;
    setRunningFlowId(flow.id);
    setError(null);
    try {
      const run = await runFlowNow(flow.id);
      await load();
      setResultsMode({ flow, highlightRunId: run.id });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Chạy flow thất bại");
    } finally {
      setRunningFlowId(null);
    }
  }, [isAuthenticated, load]);

  return (
    <AppShell>
      <PageHeader
        icon={Squares2X2Icon}
        title="Quản lý Flow"
        badge={
          isAuthReady && !isAuthenticated ? (
            <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-full">
              Khách — lưu cục bộ
            </span>
          ) : undefined
        }
        actions={
          <button
            onClick={() => setFormMode({ type: "create" })}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Tạo flow mới</span>
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-36 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : flows.length === 0 ? (
            <div className="text-center py-24 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                <Squares2X2Icon className="w-8 h-8 text-gray-600" />
              </div>
              <div>
                <p className="text-gray-300 font-medium">Chưa có flow nào</p>
                <p className="text-sm text-gray-500 mt-1">
                  Tạo quy trình AI agent với Flow Designer và lưu theo tài khoản của bạn.
                </p>
              </div>
              <button
                onClick={() => setFormMode({ type: "create" })}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Tạo flow đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  showSchedule={isAuthenticated}
                  isRunning={runningFlowId === flow.id}
                  onEdit={(f) => setFormMode({ type: "edit", flow: f })}
                  onDelete={(f) => setDeleteConfirm(f)}
                  onDuplicate={handleDuplicate}
                  onSchedule={(f) => setScheduleMode({ flow: f })}
                  onRun={handleRun}
                  onViewResults={(f) => setResultsMode({ flow: f })}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {formMode?.type === "create" && (
        <FlowForm
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setFormMode(null)}
        />
      )}

      {formMode?.type === "edit" && (
        <FlowForm
          mode="edit"
          initialName={formMode.flow.name}
          initialDescription={formMode.flow.description ?? ""}
          onSubmit={handleEditMeta}
          onClose={() => setFormMode(null)}
        />
      )}

      {scheduleMode && (
        <FlowScheduleModal
          flowId={scheduleMode.flow.id}
          flowName={scheduleMode.flow.name}
          onClose={() => setScheduleMode(null)}
          onUpdated={() => void load()}
        />
      )}

      {resultsMode && (
        <FlowRunResultsModal
          flow={resultsMode.flow}
          highlightRunId={resultsMode.highlightRunId}
          onClose={() => setResultsMode(null)}
          onRan={() => void load()}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-white">Xóa flow?</h3>
            <p className="text-xs text-gray-400 mt-2">
              Flow <span className="text-gray-200">{deleteConfirm.name}</span> sẽ bị xóa vĩnh viễn.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                Hủy
              </button>
              <button
                onClick={() => void handleDelete(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
