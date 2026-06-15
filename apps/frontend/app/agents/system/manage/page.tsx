"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServerStackIcon, PlusIcon, ArrowLeftIcon, FolderIcon, CpuChipIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryFilter } from "@/components/agents/CategoryFilter";
import { SystemAgentCard } from "@/components/agents/SystemAgentCard";
import { SystemAgentForm } from "@/components/agents/SystemAgentForm";
import { AgentDesignChat } from "@/components/agents/AgentDesignChat";
import { CategoryManager } from "@/components/agents/CategoryManager";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
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
type ManageTab = "agents" | "categories";

const TABS: { id: ManageTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "agents", labelKey: "agents.systemManage.tabAgents", icon: CpuChipIcon },
  { id: "categories", labelKey: "agents.categoriesTab", icon: FolderIcon },
];

export default function SystemAgentsManagePage() {
  const router = useRouter();
  const { isAuthReady, isAdmin } = useAuth();
  const { t } = useI18n();
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [agents, setAgents] = useState<SystemAgent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [designChatOpen, setDesignChatOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SystemAgent | null>(null);
  const [activeTab, setActiveTab] = useState<ManageTab>("agents");

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
      setError(e instanceof Error ? e.message : t("agents.systemManage.loadFailed", "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, t]);

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

  const handleDesignConfirm = async (data: SystemAgentCreateRequest) => {
    const created = await createSystemAgent(data);
    setAgents((prev) => [created, ...prev]);
    setDesignChatOpen(false);
  };

  const handleDelete = async (agent: SystemAgent) => {
    try {
      await deleteSystemAgent(agent.id);
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("errors.deleteFailed", "Delete failed"));
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (!isAuthReady || !isAdmin) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("agents.checkingPermission", "Checking permissions…")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        icon={ServerStackIcon}
        iconClassName="text-emerald-400"
        title={t("agents.manageTitle", "Manage system agents")}
        badge={
          <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full">
            {t("agents.admin", "Admin")}
          </span>
        }
        center={
          activeTab === "agents" ? (
            <CategoryFilter
              categories={categories}
              selectedId={selectedCategory}
              onSelect={setSelectedCategory}
            />
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/agents/system"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
              title={t("agents.library", "Library")}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t("agents.library", "Library")}</span>
            </Link>
            {activeTab === "agents" && (
              <>
                <button
                  onClick={() => setDesignChatOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-violet-600/60 hover:border-violet-400 text-violet-300 hover:text-violet-200 text-xs font-medium rounded-lg transition-colors"
                  title={t("agents.designChat.title", "Create agent with AI")}
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("agents.designChat.short", "Create with AI")}</span>
                </button>
                <button
                  onClick={() => setFormMode({ type: "create" })}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                  title={t("agents.newSystemAgent", "New agent")}
                >
                  <PlusIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("agents.newSystemAgent", "New agent")}</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="shrink-0 border-b border-gray-700 px-4 sm:px-6">
        <div
          role="tablist"
          aria-label={t("agents.systemManage.tabsAria", "Manage system agents")}
          className="flex gap-1 -mb-px overflow-x-auto"
        >
          {TABS.map(({ id, labelKey, icon: TabIcon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <TabIcon className="w-4 h-4 shrink-0" />
                {t(labelKey, id === "agents" ? "Agents" : "Categories")}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          {activeTab === "agents" ? (
            loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-44 bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <CpuChipIcon className="w-12 h-12 text-gray-600" />
                <p className="text-gray-400 text-sm">
                  {t("agents.systemManage.emptyInCategory", "No agents in this category.")}
                </p>
                <button
                  type="button"
                  onClick={() => setFormMode({ type: "create" })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t("agents.systemManage.createFirstInCategory", "Create first agent")}
                </button>
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
            )
          ) : (
            <CategoryManager embedded categories={categories} onChange={() => { void load(); }} />
          )}
        </div>
      </main>

      {designChatOpen && (
        <AgentDesignChat
          scope="system"
          categories={categories}
          onClose={() => setDesignChatOpen(false)}
          onConfirm={handleDesignConfirm}
        />
      )}

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
            <h2 className="text-base font-semibold text-white mb-2">
              {t("agents.systemManage.deleteTitle", "Delete system agent?")}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {t("agents.systemManage.deleteBody", "{name} will be removed from the shared library.", {
                name: deleteConfirm.name,
              })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                {t("common.delete", "Delete")}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
              >
                {t("common.cancel", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
