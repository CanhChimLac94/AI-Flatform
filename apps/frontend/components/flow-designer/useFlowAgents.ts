"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentCategory } from "@/lib/types";
import { listAgents, listAgentCategories, listSystemAgents } from "@/lib/api";
import { loadGuestAgents } from "@/lib/agentStore";
import { SAMPLE_ROLES } from "./sampleRoles";
import {
  agentToPaletteItem,
  groupSystemAgentsByCategory,
  systemAgentToPaletteItem,
  type FlowAgentCategoryGroup,
  type FlowPaletteAgent,
} from "./flowAgentPalette";

interface UseFlowAgentsResult {
  userAgents: FlowPaletteAgent[];
  systemAgents: FlowPaletteAgent[];
  systemAgentGroups: FlowAgentCategoryGroup[];
  categories: AgentCategory[];
  sampleAgents: FlowPaletteAgent[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function sampleRolesToPalette(): FlowPaletteAgent[] {
  return SAMPLE_ROLES.map((role, index) => ({
    id: `sample-${index}-${role.label}`,
    name: role.label,
    system_prompt: role.prompt,
    source: "sample" as const,
    icon: null,
  }));
}

export function useFlowAgents(isAuthenticated: boolean): UseFlowAgentsResult {
  const [userAgents, setUserAgents] = useState<FlowPaletteAgent[]>([]);
  const [systemAgents, setSystemAgents] = useState<FlowPaletteAgent[]>([]);
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [systemList, categoryList] = await Promise.all([
        listSystemAgents(),
        listAgentCategories(),
      ]);
      setCategories(categoryList);
      setSystemAgents(systemList.map(systemAgentToPaletteItem));

      if (isAuthenticated) {
        const personal = await listAgents();
        setUserAgents(personal.map((a) => agentToPaletteItem(a, "user")));
      } else {
        setUserAgents(loadGuestAgents().map((a) => agentToPaletteItem(a, "user")));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách agents");
      setCategories([]);
      setSystemAgents([]);
      setUserAgents(isAuthenticated ? [] : loadGuestAgents().map((a) => agentToPaletteItem(a, "user")));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const systemAgentGroups = useMemo(
    () => groupSystemAgentsByCategory(systemAgents, categories),
    [systemAgents, categories],
  );

  return {
    userAgents,
    systemAgents,
    systemAgentGroups,
    categories,
    sampleAgents: sampleRolesToPalette(),
    loading,
    error,
    reload: load,
  };
}
