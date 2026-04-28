"use client";

import { useEffect, useRef, useState } from "react";
import { CpuChipIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Agent } from "@/lib/types";

interface Props {
  agents: Agent[];
  activeAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}

export function AgentSelector({ agents, activeAgentId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (agents.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeAgent
            ? "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
            : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
        }`}
      >
        <CpuChipIcon className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">
          {activeAgent ? activeAgent.name : "Select agent"}
        </span>
        {activeAgent ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSelect(null); }}}
            className="ml-0.5 hover:text-white"
            aria-label="Clear agent"
          >
            <XMarkIcon className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Agents</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {activeAgent && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-800 transition-colors text-gray-400 text-sm"
              >
                <XMarkIcon className="w-4 h-4 shrink-0" />
                <span>No agent</span>
              </button>
            )}
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { onSelect(agent.id); setOpen(false); }}
                className={`w-full flex flex-col px-3 py-2.5 text-left hover:bg-gray-800 transition-colors ${
                  agent.id === activeAgentId ? "bg-blue-900/20" : ""
                }`}
              >
                <span className={`text-sm font-medium ${agent.id === activeAgentId ? "text-blue-400" : "text-white"}`}>
                  {agent.name}
                </span>
                {agent.description && (
                  <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">{agent.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
