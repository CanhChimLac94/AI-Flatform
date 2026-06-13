import type { AgentCategory } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  indigo: "bg-indigo-900/30 text-indigo-300 border-indigo-800/50",
  cyan: "bg-cyan-900/30 text-cyan-300 border-cyan-800/50",
  pink: "bg-pink-900/30 text-pink-300 border-pink-800/50",
  purple: "bg-purple-900/30 text-purple-300 border-purple-800/50",
  amber: "bg-amber-900/30 text-amber-300 border-amber-800/50",
  emerald: "bg-emerald-900/30 text-emerald-300 border-emerald-800/50",
  blue: "bg-blue-900/30 text-blue-300 border-blue-800/50",
  rose: "bg-rose-900/30 text-rose-300 border-rose-800/50",
};

export function categoryBadgeClass(color?: string): string {
  return CATEGORY_BADGE_CLASS[color ?? ""] ?? "bg-gray-700/50 text-gray-300 border-gray-600/50";
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
