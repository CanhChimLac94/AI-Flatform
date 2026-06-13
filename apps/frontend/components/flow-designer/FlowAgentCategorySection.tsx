"use client";

import type { AgentCategory } from "@/lib/types";
import { AgentIcon } from "@/components/agents/AgentIcon";
import { categoryBadgeClass } from "@/components/agents/CategoryBadge";
import { FlowAgentDraggableItem } from "./FlowAgentDraggableItem";
import type { FlowAgentCategoryGroup } from "./flowAgentPalette";

interface FlowAgentCategorySectionProps {
  group: FlowAgentCategoryGroup;
}

function CategoryGroupLabel({ category }: { category: AgentCategory | null }) {
  if (!category) {
    return (
      <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest px-1">
        Chưa phân loại
      </p>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wide ${categoryBadgeClass(category.color)}`}
    >
      <AgentIcon icon={category.icon} name={category.name} className="w-3 h-3 shrink-0" />
      {category.name}
      {category.description && (
        <span className="normal-case font-normal opacity-60 hidden min-[360px]:inline truncate max-w-[120px]">
          · {category.description}
        </span>
      )}
    </span>
  );
}

export function FlowAgentCategorySection({ group }: FlowAgentCategorySectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="px-1">
        <CategoryGroupLabel category={group.category} />
      </div>
      {group.agents.map((agent) => (
        <FlowAgentDraggableItem key={agent.id} agent={agent} showSourceBadge={false} />
      ))}
    </div>
  );
}
