"use client";

import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import type { Agent } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";
import { agentIconContainerClass, AGENT_TOOL_BADGE_CLASS } from "./agentIconVisual";

interface Props {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onDuplicate: (agent: Agent) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onDuplicate }: Props) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <AgentIcon
              icon={agent.icon}
              name={agent.name}
              categories={agent.categories}
              containerClassName={agentIconContainerClass(agent.categories, "user")}
              className="w-4 h-4"
            />
            <h3 className="text-sm font-semibold text-foreground truncate">{agent.name}</h3>
            {agent.is_public ? (
              <GlobeAltIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" title="Public" />
            ) : (
              <LockClosedIcon className="w-3.5 h-3.5 text-muted shrink-0" title="Private" />
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2">{agent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDuplicate(agent)}
            className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-colors"
            title="Duplicate"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(agent)}
            className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-colors"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(agent)}
            className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {agent.system_prompt && (
        <p className="text-xs text-muted font-mono bg-surface-muted rounded-lg px-3 py-2 line-clamp-2 border border-border">
          {agent.system_prompt}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        {agent.model && (
          <span className="text-xs bg-surface-elevated text-muted border border-border px-2 py-0.5 rounded-full">
            {agent.model}
          </span>
        )}
        {agent.tools.map((t) => (
          <span key={t} className={AGENT_TOOL_BADGE_CLASS}>
            {t}
          </span>
        ))}
        {!agent.model && agent.tools.length === 0 && (
          <span className="text-xs text-muted">No overrides</span>
        )}
      </div>
    </div>
  );
}
