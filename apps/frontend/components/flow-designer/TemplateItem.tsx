"use client";

import { FlowIcon, type FlowIconKey } from "./flowIcons";

interface TemplateItemProps {
  label: string;
  description: string;
  icon: FlowIconKey;
  onClick: () => void;
}

export function TemplateItem({ label, description, icon, onClick }: TemplateItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-3 rounded-xl bg-surface-elevated border border-border hover:border-blue-500/50 hover:bg-surface-hover transition-all text-left group w-full cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center border border-blue-500/25 group-hover:bg-blue-500/25 transition-colors">
          <FlowIcon icon={icon} className="w-4 h-4 text-blue-700 dark:text-blue-300" />
        </div>
        <span className="text-[11px] font-bold text-foreground">{label}</span>
      </div>
      <p className="text-[9px] text-muted leading-relaxed group-hover:text-foreground/80 transition-colors">
        {description}
      </p>
    </button>
  );
}
