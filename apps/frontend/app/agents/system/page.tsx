"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServerStackIcon, PlusIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryFilter } from "@/components/agents/CategoryFilter";
import { SystemAgentCard } from "@/components/agents/SystemAgentCard";
import { useAuth } from "@/contexts/AuthContext";
import type { AgentCategory, SystemAgent } from "@/lib/types";
import {
  listAgentCategories,
  listSystemAgents,
  duplicateSystemAgent,
} from "@/lib/api";

export default function SystemAgentsPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuth();
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [agents, setAgents] = useState<SystemAgent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : "Không tải được thư viện agents");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDuplicate = async (agent: SystemAgent) => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    try {
      await duplicateSystemAgent(agent.id);
      setMessage(`Đã sao chép "${agent.name}" vào agents cá nhân.`);
      setTimeout(() => setMessage(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sao chép thất bại");
    }
  };

  return (
    <AppShell>
      <PageHeader
        icon={ServerStackIcon}
        iconClassName="text-emerald-400"
        title="Agents hệ thống"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agents"
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white rounded-lg transition-colors"
              title="Agents cá nhân"
            >
              <span className="hidden sm:inline">Agents cá nhân</span>
              <span className="sm:hidden">Cá nhân</span>
            </Link>
            {isAdmin && (
              <Link
                href="/agents/system/manage"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                title="Quản lý"
              >
                <Cog6ToothIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Quản lý</span>
              </Link>
            )}
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
          <p className="text-sm text-gray-400">
            Thư viện agents dùng chung cho mọi tài khoản. Sao chép về agents cá nhân để tùy chỉnh và sử dụng trong chat.
          </p>

          {message && (
            <div className="text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-800 rounded-lg px-4 py-2.5">
              {message}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

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
          ) : agents.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center gap-3">
              <ServerStackIcon className="w-12 h-12 text-gray-600" />
              <p className="text-gray-400">Chưa có agent hệ thống trong nhóm này.</p>
              {isAdmin && (
                <Link
                  href="/agents/system/manage"
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
                >
                  <PlusIcon className="w-4 h-4" />
                  Tạo agent đầu tiên
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <SystemAgentCard
                  key={agent.id}
                  agent={agent}
                  isAdmin={isAdmin}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
