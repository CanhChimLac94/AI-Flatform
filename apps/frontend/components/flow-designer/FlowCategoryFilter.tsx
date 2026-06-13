"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { AgentCategory } from "@/lib/types";
import { AgentIcon } from "@/components/agents/AgentIcon";
import { categoryBadgeClass } from "@/components/agents/CategoryBadge";
import { FLOW_UNCATEGORIZED } from "./flowAgentPalette";

const CATEGORY_TEXT_COLOR: Record<string, string> = {
  indigo: "text-indigo-300",
  cyan: "text-cyan-300",
  pink: "text-pink-300",
  purple: "text-purple-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  blue: "text-blue-300",
  rose: "text-rose-300",
};

function categoryTextColor(color?: string): string {
  return CATEGORY_TEXT_COLOR[color ?? ""] ?? "text-white/70";
}

interface FlowCategoryFilterProps {
  categories: AgentCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showUncategorized?: boolean;
}

/** Flat label for closed trigger — no pill background */
function TriggerLabel({
  category,
  label,
}: {
  category: AgentCategory | null;
  label?: string;
}) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-white/50">
        <Squares2X2Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label ?? "Tất cả nhóm"}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-white/70 min-w-0">
      <AgentIcon
        icon={category.icon}
        name={category.name}
        className={`w-3.5 h-3.5 shrink-0 ${categoryTextColor(category.color)}`}
      />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

function MenuOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 mx-1 rounded-lg text-left transition-colors max-w-[calc(100%-0.5rem)] ${
        selected
          ? "bg-white/10 text-white"
          : "text-white/75 hover:bg-white/8 hover:text-white"
      }`}
    >
      {children}
      {selected && <CheckIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
    </button>
  );
}

function CategoryMenuLabel({ category }: { category: AgentCategory }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${categoryBadgeClass(category.color)}`}
      >
        <AgentIcon icon={category.icon} name={category.name} className="w-3.5 h-3.5" />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[11px] font-medium truncate">{category.name}</span>
        {category.description && (
          <span className="text-[9px] text-white/40 truncate">{category.description}</span>
        )}
      </span>
    </span>
  );
}

export function FlowCategoryFilter({
  categories,
  selectedId,
  onSelect,
  showUncategorized = false,
}: FlowCategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected =
    selectedId === FLOW_UNCATEGORIZED
      ? null
      : categories.find((c) => c.id === selectedId) ?? null;

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
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Lọc agents theo nhóm phân loại"
        className={`w-full flex items-center justify-between gap-2 py-1 text-left transition-colors focus:outline-none focus-visible:text-white ${
          open ? "text-white/80" : "text-white/50 hover:text-white/80"
        }`}
      >
        {selectedId === FLOW_UNCATEGORIZED ? (
          <span className="text-[11px] text-white/60">Chưa phân loại</span>
        ) : (
          <TriggerLabel category={selected} />
        )}
        <ChevronDownIcon
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180 text-white/60" : "text-white/40"}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Nhóm phân loại"
          className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/70 max-h-64 overflow-y-auto flow-dark-scrollbar"
        >
          <p className="px-3 pb-1 text-[9px] font-medium uppercase tracking-wider text-white/30">
            Nhóm phân loại
          </p>

          <MenuOption selected={selectedId === null} onClick={() => pick(null)}>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/5 text-white/50">
                <Squares2X2Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-[11px] font-medium">Tất cả nhóm</span>
            </span>
          </MenuOption>

          {categories.length > 0 && (
            <div className="my-1 mx-2.5 border-t border-white/8" />
          )}

          {categories.map((cat) => (
            <MenuOption
              key={cat.id}
              selected={selectedId === cat.id}
              onClick={() => pick(cat.id)}
            >
              <CategoryMenuLabel category={cat} />
            </MenuOption>
          ))}

          {showUncategorized && (
            <>
              <div className="my-1 mx-2.5 border-t border-white/8" />
              <MenuOption
                selected={selectedId === FLOW_UNCATEGORIZED}
                onClick={() => pick(FLOW_UNCATEGORIZED)}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white/5 text-white/40">
                    <span className="text-[10px] font-bold">?</span>
                  </span>
                  <span className="text-[11px] font-medium text-white/70">Chưa phân loại</span>
                </span>
              </MenuOption>
            </>
          )}
        </div>
      )}
    </div>
  );
}
