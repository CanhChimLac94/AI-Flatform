"use client";

import {
  DocumentDuplicateIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { SystemAgent } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { AgentIcon } from "./AgentIcon";

interface Props {
  agent: SystemAgent;
  isAdmin?: boolean;
  onDuplicate?: (agent: SystemAgent) => void;
  onEdit?: (agent: SystemAgent) => void;
  onDelete?: (agent: SystemAgent) => void;
}

export function SystemAgentCard({ agent, isAdmin, onDuplicate, onEdit, onDelete }: Props) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <AgentIcon
              icon={agent.icon}
              name={agent.name}
              categories={agent.categories}
              containerClassName="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-900/30 border border-emerald-800/50 shrink-0"
              className="w-4 h-4 text-emerald-400"
            />
            <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
          </div>
          {agent.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{agent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(agent)}
              className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              title="Sao chép vào agents cá nhân"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
            </button>
          )}
          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              title="Chỉnh sửa"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(agent)}
              className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
              title="Xóa"
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
        <p className="text-xs text-gray-500 font-mono bg-gray-900/50 rounded-lg px-3 py-2 line-clamp-2 border border-gray-700/50">
          {agent.system_prompt}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        {agent.model && (
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
            {agent.model}
          </span>
        )}
        {agent.tools.map((t) => (
          <span
            key={t}
            className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-full"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
