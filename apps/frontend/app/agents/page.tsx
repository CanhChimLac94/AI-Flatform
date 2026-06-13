"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon, CpuChipIcon, Squares2X2Icon, ServerStackIcon } from "@heroicons/react/24/outline";
import type { Agent, AgentCreateRequest, AgentUpdateRequest } from "@/lib/types";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentForm } from "@/components/agents/AgentForm";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  listAgents, createAgent, updateAgent, deleteAgent, duplicateAgent,
} from "@/lib/api";
import {
  loadGuestAgents, createGuestAgent, updateGuestAgent,
  deleteGuestAgent, duplicateGuestAgent,
} from "@/lib/agentStore";

type FormMode = { type: "create" } | { type: "edit"; agent: Agent } | null;

export default function AgentsPage() {
  const { isAuthenticated } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        setAgents(await listAgents());
      } else {
        setAgents(loadGuestAgents());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = useCallback(async (data: AgentCreateRequest | AgentUpdateRequest) => {
    if (formMode?.type === "edit") {
      const id = formMode.agent.id;
      if (isAuthenticated) {
        const updated = await updateAgent(id, data as AgentUpdateRequest);
        setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      } else {
        const updated = updateGuestAgent(id, data);
        if (updated) setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
    } else {
      if (isAuthenticated) {
        const created = await createAgent(data as AgentCreateRequest);
        setAgents((prev) => [created, ...prev]);
      } else {
        const created = createGuestAgent({
          ...(data as AgentCreateRequest),
          system_prompt: (data as AgentCreateRequest).system_prompt ?? "",
          params: {},
          tools: data.tools ?? [],
          is_public: data.is_public ?? false,
        });
        setAgents((prev) => [created, ...prev]);
      }
    }
    setFormMode(null);
  }, [formMode, isAuthenticated]);

  const handleDuplicate = useCallback(async (agent: Agent) => {
    try {
      if (isAuthenticated) {
        const copy = await duplicateAgent(agent.id);
        setAgents((prev) => [copy, ...prev]);
      } else {
        const copy = duplicateGuestAgent(agent.id);
        if (copy) setAgents((prev) => [copy, ...prev]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    }
  }, [isAuthenticated]);

  const handleDelete = useCallback(async (agent: Agent) => {
    try {
      if (isAuthenticated) {
        await deleteAgent(agent.id);
      } else {
        deleteGuestAgent(agent.id);
      }
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteConfirm(null);
    }
  }, [isAuthenticated]);

  return (
    <AppShell>
      <PageHeader
        icon={CpuChipIcon}
        title="Agents"
        badge={
          !isAuthenticated ? (
            <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-full">
              Guest — saved locally
            </span>
          ) : undefined
        }
        actions={
          <>
            <Link
              href="/agents/system"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-emerald-700/50 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 text-xs font-medium rounded-lg transition-colors"
              title="Thư viện hệ thống"
            >
              <ServerStackIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Thư viện hệ thống</span>
            </Link>
            <Link
              href="/agents/flow"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
              title="Flow Designer"
            >
              <Squares2X2Icon className="w-4 h-4" />
              <span className="hidden sm:inline">Flow Designer</span>
            </Link>
            <button
              onClick={() => setFormMode({ type: "create" })}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
              title="New agent"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">New agent</span>
            </button>
          </>
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
                <div key={i} className="h-40 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-24 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
                <CpuChipIcon className="w-8 h-8 text-gray-600" />
              </div>
              <div>
                <p className="text-gray-300 font-medium">No agents yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Create a custom agent with its own system prompt, model, and tools.
                </p>
              </div>
              <button
                onClick={() => setFormMode({ type: "create" })}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Create your first agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={(a) => setFormMode({ type: "edit", agent: a })}
                  onDelete={(a) => setDeleteConfirm(a)}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {formMode && (
        <AgentForm
          initial={formMode.type === "edit" ? formMode.agent : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setFormMode(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-2">Delete agent?</h2>
            <p className="text-sm text-gray-400 mb-6">
              <span className="text-white font-medium">{deleteConfirm.name}</span> will be permanently deleted.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
