"use client";

import {
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { SystemAgent } from "@/lib/types";
import { useI18n } from "@/contexts/I18nContext";
import { CategoryBadge } from "./CategoryBadge";
import { AgentIcon } from "./AgentIcon";
import { agentIconContainerClass, AGENT_TOOL_BADGE_CLASS } from "./agentIconVisual";

interface Props {
  agent: SystemAgent;
  isAdmin?: boolean;
  onDuplicate?: (agent: SystemAgent) => void;
  onEdit?: (agent: SystemAgent) => void;
  onDelete?: (agent: SystemAgent) => void;
}

const TOOL_LABEL_KEYS: Record<string, string> = {
  web_search: "agents.form.toolWebSearch",
};

export function SystemAgentCard({ agent, isAdmin, onDuplicate, onEdit, onDelete }: Props) {
  const { t } = useI18n();

  const toolLabel = (toolId: string) => {
    const key = TOOL_LABEL_KEYS[toolId];
    return key ? t(key, toolId) : toolId;
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-emerald-500/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <AgentIcon
              icon={agent.icon}
              name={agent.name}
              categories={agent.categories}
              containerClassName={agentIconContainerClass(agent.categories, "system")}
              className="w-4 h-4"
            />
            <h3 className="text-sm font-semibold text-foreground truncate">{agent.name}</h3>
          </div>
          {agent.description && (
            <p className="text-xs text-muted mt-1 line-clamp-2">{agent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(agent)}
              className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-colors"
              title={t("agents.systemCard.duplicateTitle", "Copy to personal agents")}
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
            </button>
          )}
          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-hover transition-colors"
              title={t("agents.systemCard.editTitle", "Edit")}
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(agent)}
              className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
              title={t("agents.systemCard.deleteTitle", "Delete")}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {agent.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.categories.map((cat) => (
            <CategoryBadge key={cat.id} category={cat} />
          ))}
        </div>
      )}

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
        {agent.tools.map((toolId) => (
          <span key={toolId} className={AGENT_TOOL_BADGE_CLASS}>
            {toolLabel(toolId)}
          </span>
        ))}
      </div>
    </div>
  );
}
