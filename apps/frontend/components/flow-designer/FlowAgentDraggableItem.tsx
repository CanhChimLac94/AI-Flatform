"use client";

import { AgentIcon } from "@/components/agents/AgentIcon";
import type { NodeType } from "./types";
import {
  buildAgentDropData,
  resolveFlowAgentIconColor,
  sourceBadgeLabel,
  type FlowPaletteAgent,
} from "./flowAgentPalette";
import { FlowIcon } from "./flowIcons";

interface FlowAgentDraggableItemProps {
  agent: FlowPaletteAgent;
  showSourceBadge?: boolean;
}

export function FlowAgentDraggableItem({ agent, showSourceBadge = true }: FlowAgentDraggableItemProps) {
  const type: NodeType = "agent";
  const iconColor = resolveFlowAgentIconColor(agent);
  const badge = showSourceBadge ? sourceBadgeLabel(agent.source) : null;

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.setData("application/reactflow-data", JSON.stringify(buildAgentDropData(agent)));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all cursor-grab active:cursor-grabbing group select-none"
      onDragStart={onDragStart}
      draggable
      title={agent.description || agent.system_prompt}
    >
      <div
        className={`w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform flex-shrink-0 ${iconColor}`}
      >
        <AgentIcon icon={agent.icon} name={agent.name} categories={agent.categories} className="w-4 h-4" />
      </div>
      <div className="flex flex-col overflow-hidden min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium text-white/90 truncate">{agent.name}</span>
          {badge && (
            <span className="text-[7px] uppercase tracking-wider px-1 py-0.5 rounded bg-white/5 text-white/30 shrink-0">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[8px] text-white/20 uppercase tracking-tighter">Kéo thả</span>
      </div>
      <FlowIcon icon="drag" className="w-[14px] h-[14px] text-white/5 ml-auto shrink-0" />
    </div>
  );
}
