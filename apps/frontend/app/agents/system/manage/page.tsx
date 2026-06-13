"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServerStackIcon, PlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryFilter } from "@/components/agents/CategoryFilter";
import { SystemAgentCard } from "@/components/agents/SystemAgentCard";
import { SystemAgentForm } from "@/components/agents/SystemAgentForm";
import { CategoryManager } from "@/components/agents/CategoryManager";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AgentCategory,
  SystemAgent,
  SystemAgentCreateRequest,
  SystemAgentUpdateRequest,
} from "@/lib/types";
import {
  listAgentCategories,
  listSystemAgents,
  createSystemAgent,
  updateSystemAgent,
  deleteSystemAgent,
} from "@/lib/api";

type FormMode = { type: "create" } | { type: "edit"; agent: SystemAgent } | null;

export default function SystemAgentsManagePage() {
  const router = useRouter();
  const { isAuthReady, isAdmin } = useAuth();
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [agents, setAgents] = useState<SystemAgent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SystemAgent | null>(null);

  useEffect(() => {
    if (isAuthReady && !isAdmin) {
      router.replace("/agents/system");
    }
  }, [isAuthReady, isAdmin, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, list] = await Promise.all([
        listAgentCategories(),
        listSystemAgents(selectedCategory ?? undefined),
      ]);
      setCategories(cats);
      setAgents(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Tải dữ liệu thất bại");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  const handleSubmit = async (data: SystemAgentCreateRequest | SystemAgentUpdateRequest) => {
    if (formMode?.type === "edit") {
      const updated = await updateSystemAgent(formMode.agent.id, data as SystemAgentUpdateRequest);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      const created = await createSystemAgent(data as SystemAgentCreateRequest);
      setAgents((prev) => [created, ...prev]);
    }
    setFormMode(null);
  };

  const handleDelete = async (agent: SystemAgent) => {
    try {
      await deleteSystemAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Xóa thất bại");
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (!isAuthReady || !isAdmin) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Đang kiểm tra quyền...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        icon={ServerStackIcon}
        iconClassName="text-emerald-400"
        title="Quản lý agents hệ thống"
        badge={
          <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">
            Admin
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/agents/system"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
              title="Thư viện"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Thư viện</span>
            </Link>
            <button
              onClick={() => setFormMode({ type: "create" })}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
              title="Agent mới"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Agent mới</span>
            </button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <CategoryManager categories={categories} onChange={() => { void load(); }} />

          <CategoryFilter
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-44 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <SystemAgentCard
                  key={agent.id}
                  agent={agent}
                  isAdmin
                  onEdit={(a) => setFormMode({ type: "edit", agent: a })}
                  onDelete={(a) => setDeleteConfirm(a)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {formMode && (
        <SystemAgentForm
          categories={categories}
          initial={formMode.type === "edit" ? formMode.agent : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setFormMode(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-2">Xóa agent hệ thống?</h2>
            <p className="text-sm text-gray-400 mb-6">
              <span className="text-white font-medium">{deleteConfirm.name}</span> sẽ bị xóa khỏi thư viện chung.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Xóa
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
