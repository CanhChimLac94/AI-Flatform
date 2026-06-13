"use client";

import { getAgentIconComponent, resolveAgentIconKey } from "@/lib/agentIcons";
import type { AgentCategory } from "@/lib/types";

interface AgentIconProps {
  icon?: string | null;
  name: string;
  categories?: Pick<AgentCategory, "icon">[];
  className?: string;
  containerClassName?: string;
}

export function AgentIcon({
  icon,
  name,
  categories,
  className = "w-4 h-4",
  containerClassName,
}: AgentIconProps) {
  const key = resolveAgentIconKey(icon, name, categories);
  const Icon = getAgentIconComponent(key);

  if (containerClassName) {
    return (
      <span className={containerClassName}>
        <Icon className={className} />
      </span>
    );
  }

  return <Icon className={className} />;
}
