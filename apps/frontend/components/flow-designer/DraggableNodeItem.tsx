"use client";

import type { NodeType } from "./types";
import { FlowIcon, type FlowIconKey } from "./flowIcons";

interface DraggableNodeItemProps {
  type: NodeType;
  label: string;
  icon: FlowIconKey;
  color: string;
  data?: Record<string, unknown>;
}

export function DraggableNodeItem({ type, label, icon, color, data }: DraggableNodeItemProps) {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (data) {
      event.dataTransfer.setData("application/reactflow-data", JSON.stringify(data));
    }
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-elevated border border-border hover:border-indigo-500/40 hover:bg-surface-hover transition-all cursor-grab active:cursor-grabbing group select-none"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center border border-border group-hover:scale-110 transition-transform flex-shrink-0">
        <FlowIcon icon={icon} className={`w-[18px] h-[18px] ${color}`} />
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className="text-[11px] font-medium text-foreground truncate">{label}</span>
        <span className="text-[8px] text-muted uppercase tracking-tighter">Kéo thả</span>
      </div>
      <FlowIcon icon="drag" className="w-[14px] h-[14px] text-muted/40 ml-auto shrink-0" />
    </div>
  );
}
