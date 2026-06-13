"use client";

import type { AgentCategory } from "@/lib/types";
import { categoryBadgeClass } from "./CategoryBadge";
import { AgentIcon } from "./AgentIcon";

interface Props {
  categories: AgentCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryFilter({ categories, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
          selectedId === null
            ? "bg-accent text-white border-accent"
            : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
        }`}
      >
        Tất cả
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            selectedId === cat.id
              ? "bg-accent text-white border-accent"
              : `${categoryBadgeClass(cat.color)} hover:opacity-90`
          }`}
        >
          <AgentIcon icon={cat.icon} name={cat.name} className="w-3.5 h-3.5 shrink-0" />
          {cat.name}
        </button>
      ))}
    </div>
  );
}
