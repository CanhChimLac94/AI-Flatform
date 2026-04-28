"use client";

import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import type { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onDuplicate: (agent: Agent) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onDuplicate }: Props) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
            {agent.is_public ? (
              <GlobeAltIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" title="Public" />
            ) : (
              <LockClosedIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" title="Private" />
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{agent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDuplicate(agent)}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            title="Duplicate"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(agent)}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(agent)}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

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
          <span key={t} className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-full">
            {t}
          </span>
        ))}
        {!agent.model && agent.tools.length === 0 && (
          <span className="text-xs text-gray-600">No overrides</span>
        )}
      </div>
    </div>
  );
}
