import type { AgentCategory } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  indigo:
    "bg-indigo-500/15 text-indigo-900 border-indigo-500/35 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50",
  cyan:
    "bg-cyan-500/15 text-cyan-900 border-cyan-500/35 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800/50",
  pink:
    "bg-pink-500/15 text-pink-900 border-pink-500/35 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800/50",
  purple:
    "bg-purple-500/15 text-purple-900 border-purple-500/35 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50",
  amber:
    "bg-amber-500/15 text-amber-900 border-amber-500/35 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
  emerald:
    "bg-emerald-500/15 text-emerald-900 border-emerald-500/35 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50",
  blue:
    "bg-blue-500/15 text-blue-900 border-blue-500/35 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50",
  rose:
    "bg-rose-500/15 text-rose-900 border-rose-500/35 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50",
};

export function categoryBadgeClass(color?: string): string {
  return (
    CATEGORY_BADGE_CLASS[color ?? ""] ??
    "bg-surface-elevated text-foreground border-border dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600/50"
  );
}

export function CategoryBadge({ category }: { category: AgentCategory }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${categoryBadgeClass(category.color)}`}
    >
      <AgentIcon icon={category.icon} name={category.name} className="w-3 h-3 shrink-0" />
      {category.name}
    </span>
  );
}
