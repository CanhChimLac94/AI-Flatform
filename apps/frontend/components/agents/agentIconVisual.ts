import type { AgentCategory } from "@/lib/types";
import { categoryBadgeClass } from "./CategoryBadge";

const ICON_BOX =
  "flex items-center justify-center w-8 h-8 rounded-lg border shrink-0";

export const USER_AGENT_ICON_FALLBACK =
  "bg-indigo-500/15 text-indigo-800 border-indigo-500/35 dark:bg-indigo-900/25 dark:text-indigo-300 dark:border-indigo-700/50";

export const SYSTEM_AGENT_ICON_FALLBACK =
  "bg-emerald-500/15 text-emerald-800 border-emerald-500/35 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";

/** Icon box + inherited icon color for agent cards (theme-aware). */
export function agentIconContainerClass(
  categories?: Pick<AgentCategory, "color">[],
  variant: "user" | "system" = "user",
): string {
  const cat = categories?.[0];
  if (cat?.color) {
    return `${ICON_BOX} ${categoryBadgeClass(cat.color)}`;
  }
  const fallback = variant === "system" ? SYSTEM_AGENT_ICON_FALLBACK : USER_AGENT_ICON_FALLBACK;
  return `${ICON_BOX} ${fallback}`;
}

export const AGENT_TOOL_BADGE_CLASS =
  "text-xs bg-blue-500/15 text-blue-800 border border-blue-500/35 px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50";
