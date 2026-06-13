"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { AgentCategory } from "@/lib/types";
import { AgentIcon } from "./AgentIcon";
import { categoryBadgeClass } from "./CategoryBadge";

interface Props {
  categories: AgentCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

function CategoryPill({
  category,
  className = "",
}: {
  category: Pick<AgentCategory, "name" | "icon" | "color"> | null;
  className?: string;
}) {
  if (!category) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-gray-800 text-gray-300 border-gray-600 ${className}`}
      >
        <Squares2X2Icon className="w-3.5 h-3.5 shrink-0" />
        Tất cả nhóm
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${categoryBadgeClass(category.color)} ${className}`}
    >
      <AgentIcon icon={category.icon} name={category.name} className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

export function CategoryFilter({ categories, selectedId, onSelect, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = categories.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chọn nhóm phân loại agents"
        className="group inline-flex items-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <CategoryPill category={selected} className="group-hover:opacity-90 transition-opacity max-w-[200px] sm:max-w-[240px]" />
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Nhóm phân loại"
          className="absolute z-50 top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-[min(280px,calc(100vw-2rem))] py-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl shadow-black/50"
        >
          <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Nhóm phân loại
          </p>

          <button
            type="button"
            role="option"
            aria-selected={selectedId === null}
            onClick={() => pick(null)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-800/80 ${
              selectedId === null ? "bg-gray-800/60" : ""
            }`}
          >
            <CategoryPill category={null} />
            {selectedId === null && <CheckIcon className="w-4 h-4 text-accent shrink-0" />}
          </button>

          <div className="my-1.5 mx-3 border-t border-gray-700/80" />

          <div className="max-h-64 overflow-y-auto py-0.5">
            {categories.map((cat) => {
              const isSelected = selectedId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => pick(cat.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-800/80 ${
                    isSelected ? "bg-gray-800/60" : ""
                  }`}
                >
                  <CategoryPill category={cat} />
                  {isSelected && <CheckIcon className="w-4 h-4 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
