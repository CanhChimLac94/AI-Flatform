"use client";

import { AgentIcon } from "@/components/agents/AgentIcon";
import type { NodeType } from "./types";
import {
  buildAgentDropData,
  resolveFlowAgentIconColor,
  sourceBadgeLabelKey,
  type FlowPaletteAgent,
} from "./flowAgentPalette";
import { FlowIcon } from "./flowIcons";
import { useI18n } from "@/contexts/I18nContext";

interface FlowAgentDraggableItemProps {
  agent: FlowPaletteAgent;
  showSourceBadge?: boolean;
}

export function FlowAgentDraggableItem({ agent, showSourceBadge = true }: FlowAgentDraggableItemProps) {
  const { t } = useI18n();
  const type: NodeType = "agent";
  const iconColor = resolveFlowAgentIconColor(agent);
  const badgeKey = showSourceBadge ? sourceBadgeLabelKey(agent.source) : null;

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.setData("application/reactflow-data", JSON.stringify(buildAgentDropData(agent)));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-elevated border border-border hover:border-indigo-500/40 hover:bg-surface-hover transition-all cursor-grab active:cursor-grabbing group select-none"
      onDragStart={onDragStart}
      draggable
      title={agent.description || agent.system_prompt}
    >
      <div
        className={`w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center border border-border group-hover:scale-110 transition-transform flex-shrink-0 ${iconColor}`}
      >
        <AgentIcon icon={agent.icon} name={agent.name} categories={agent.categories} className="w-4 h-4" />
      </div>
      <div className="flex flex-col overflow-hidden min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium text-foreground truncate">{agent.name}</span>
          {badgeKey && (
            <span className="text-[7px] uppercase tracking-wider px-1 py-0.5 rounded bg-surface-muted text-muted border border-border shrink-0">
              {t(badgeKey)}
            </span>
          )}
        </div>
        <span className="text-[8px] text-muted uppercase tracking-tighter">
          {t("flows.dragHint", "Drag to canvas")}
        </span>
      </div>
      <FlowIcon icon="drag" className="w-[14px] h-[14px] text-muted/40 ml-auto shrink-0" />
    </div>
  );
}
