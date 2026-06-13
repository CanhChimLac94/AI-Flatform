"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Agent, SystemAgent } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";

interface Props {
  agents: Agent[];
  systemAgents?: SystemAgent[];
  activeAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}

export function AgentSelector({ agents, systemAgents = [], activeAgentId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const allItems = [
    ...agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      categories: undefined,
      kind: "personal" as const,
    })),
    ...systemAgents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      categories: a.categories,
      kind: "system" as const,
    })),
  ];
  const activeAgent = allItems.find((a) => a.id === activeAgentId) ?? null;
  const activeIsSystem = systemAgents.some((a) => a.id === activeAgentId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (allItems.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeAgent
            ? activeIsSystem
              ? "bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30"
              : "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
            : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
        }`}
      >
        {activeAgent ? (
          <AgentIcon
            icon={activeAgent.icon}
            name={activeAgent.name}
            categories={activeAgent.categories}
            className="w-3.5 h-3.5 shrink-0"
          />
        ) : null}
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
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {activeAgent && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-800 transition-colors text-gray-400 text-sm border-b border-gray-800"
              >
                <XMarkIcon className="w-4 h-4 shrink-0" />
                <span>No agent</span>
              </button>
            )}

            {agents.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-gray-800">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cá nhân</p>
                </div>
                {agents.map((agent) => (
                  <AgentOption
                    key={agent.id}
                    name={agent.name}
                    description={agent.description}
                    icon={agent.icon}
                    active={agent.id === activeAgentId}
                    onSelect={() => { onSelect(agent.id); setOpen(false); }}
                  />
                ))}
              </>
            )}

            {systemAgents.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-gray-800">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Hệ thống</p>
                </div>
                {systemAgents.map((agent) => (
                  <AgentOption
                    key={agent.id}
                    name={agent.name}
                    description={agent.description}
                    icon={agent.icon}
                    categories={agent.categories}
                    active={agent.id === activeAgentId}
                    system
                    onSelect={() => { onSelect(agent.id); setOpen(false); }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentOption({
  name,
  description,
  icon,
  categories,
  active,
  system,
  onSelect,
}: {
  name: string;
  description?: string;
  icon?: string | null;
  categories?: SystemAgent["categories"];
  active: boolean;
  system?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-800 transition-colors ${
        active ? (system ? "bg-emerald-900/20" : "bg-blue-900/20") : ""
      }`}
    >
      <AgentIcon
        icon={icon}
        name={name}
        categories={categories}
        containerClassName="mt-0.5 flex items-center justify-center w-7 h-7 rounded-md bg-gray-800 border border-gray-700 shrink-0"
        className={`w-3.5 h-3.5 ${system ? "text-emerald-400" : "text-blue-400"}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`text-sm font-medium block truncate ${
          active ? (system ? "text-emerald-400" : "text-blue-400") : "text-white"
        }`}>
          {name}
        </span>
        {description && (
          <span className="text-xs text-gray-500 mt-0.5 line-clamp-1 block">{description}</span>
        )}
      </span>
    </button>
  );
}
