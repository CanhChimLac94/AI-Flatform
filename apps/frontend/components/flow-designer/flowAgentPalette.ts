import type { Agent, AgentCategory, SystemAgent } from "@/lib/types";

export type FlowAgentSource = "user" | "system" | "sample";

export interface FlowPaletteAgent {
  id: string;
  name: string;
  description?: string;
  system_prompt: string;
  model?: string;
  icon?: string | null;
  source: FlowAgentSource;
  categories?: AgentCategory[];
}

export interface FlowAgentCategoryGroup {
  category: AgentCategory | null;
  agents: FlowPaletteAgent[];
}

const CATEGORY_ICON_COLOR: Record<string, string> = {
  indigo: "text-indigo-700 dark:text-indigo-300",
  cyan: "text-cyan-700 dark:text-cyan-300",
  pink: "text-pink-700 dark:text-pink-300",
  purple: "text-purple-700 dark:text-purple-300",
  amber: "text-amber-700 dark:text-amber-300",
  emerald: "text-emerald-700 dark:text-emerald-300",
  blue: "text-blue-700 dark:text-blue-300",
  rose: "text-rose-700 dark:text-rose-300",
};

export function resolveFlowAgentIconColor(agent: FlowPaletteAgent): string {
  if (agent.source === "sample") return "text-blue-700 dark:text-blue-300";
  const catColor = agent.categories?.[0]?.color;
  if (catColor) return CATEGORY_ICON_COLOR[catColor] ?? "text-purple-700 dark:text-purple-300";
  if (agent.source === "user") return "text-emerald-700 dark:text-emerald-300";
  return "text-purple-700 dark:text-purple-300";
}

export function agentToPaletteItem(agent: Agent, source: FlowAgentSource = "user"): FlowPaletteAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    system_prompt: agent.system_prompt,
    model: agent.model,
    icon: agent.icon,
    source,
    categories: agent.categories,
  };
}

export function systemAgentToPaletteItem(agent: SystemAgent): FlowPaletteAgent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    system_prompt: agent.system_prompt,
    model: agent.model,
    icon: agent.icon,
    source: "system",
    categories: agent.categories,
  };
}

export function buildAgentDropData(agent: FlowPaletteAgent): Record<string, unknown> {
  return {
    label: agent.name,
    prompt: agent.system_prompt,
    model: agent.model || "Gemini",
    agentId: agent.id,
    agentSource: agent.source,
  };
}

export function sourceBadgeLabel(source: FlowAgentSource): string | null {
  if (source === "system") return "Hệ thống";
  if (source === "user") return "Cá nhân";
  return null;
}

/** Group default/system agents by catalog category (one agent → first matching group). */
export function groupSystemAgentsByCategory(
  agents: FlowPaletteAgent[],
  categories: AgentCategory[],
): FlowAgentCategoryGroup[] {
  const sorted = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  );
  const assigned = new Set<string>();
  const groups: FlowAgentCategoryGroup[] = [];

  for (const category of sorted) {
    const categoryAgents = agents.filter((agent) => {
      if (assigned.has(agent.id)) return false;
      return agent.categories?.some((c) => c.id === category.id);
    });
    categoryAgents.forEach((a) => assigned.add(a.id));
    if (categoryAgents.length > 0) {
      groups.push({ category, agents: categoryAgents });
    }
  }

  const uncategorized = agents.filter((a) => !assigned.has(a.id));
  if (uncategorized.length > 0) {
    groups.push({ category: null, agents: uncategorized });
  }

  return groups;
}

export const FLOW_UNCATEGORIZED = "__uncategorized__";

export function filterAgentsByCategory(
  agents: FlowPaletteAgent[],
  categoryId: string | null,
): FlowPaletteAgent[] {
  if (categoryId === null) return agents;
  if (categoryId === FLOW_UNCATEGORIZED) {
    return agents.filter((a) => !a.categories?.length);
  }
  return agents.filter((a) => a.categories?.some((c) => c.id === categoryId));
}

/** @deprecated Use filterAgentsByCategory */
export const filterSystemAgentsByCategory = filterAgentsByCategory;

export function filterAgentGroupsByCategory(
  groups: FlowAgentCategoryGroup[],
  categoryId: string | null,
): FlowAgentCategoryGroup[] {
  if (categoryId === null) return groups;
  if (categoryId === FLOW_UNCATEGORIZED) {
    return groups.filter((g) => g.category === null);
  }
  return groups.filter((g) => g.category?.id === categoryId);
}

/** @deprecated Use filterAgentGroupsByCategory */
export const filterSystemAgentGroups = filterAgentGroupsByCategory;
