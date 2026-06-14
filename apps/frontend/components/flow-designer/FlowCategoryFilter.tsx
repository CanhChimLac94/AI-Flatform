"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { AgentCategory } from "@/lib/types";
import { AgentIcon } from "@/components/agents/AgentIcon";
import { categoryBadgeClass } from "@/components/agents/CategoryBadge";
import { useI18n } from "@/contexts/I18nContext";
import { FLOW_UNCATEGORIZED } from "./flowAgentPalette";

interface FlowCategoryFilterProps {
  categories: AgentCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showUncategorized?: boolean;
}

function TriggerLabel({
  category,
  label,
}: {
  category: AgentCategory | null;
  label?: string;
}) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-muted">
        <Squares2X2Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 text-[11px] min-w-0 px-2 py-0.5 rounded-full border font-medium ${categoryBadgeClass(category.color)}`}
    >
      <AgentIcon icon={category.icon} name={category.name} className="w-3.5 h-3.5 shrink-0" />
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
          ? "bg-surface-elevated text-foreground"
          : "text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {children}
      {selected && <CheckIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
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
        <span className="text-[11px] font-medium truncate text-foreground">{category.name}</span>
        {category.description && (
          <span className="text-[9px] text-muted truncate">{category.description}</span>
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
  const { t } = useI18n();
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

  const allGroupsLabel = t("flows.categoryFilter.allGroups", "All categories");
  const uncategorizedLabel = t("flows.categoryFilter.uncategorized", "Uncategorized");

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("flows.categoryFilter.ariaLabel", "Filter agents by category")}
        className={`w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg border border-border bg-input-bg text-left transition-colors focus:outline-none ${
          open ? "text-foreground" : "text-muted hover:text-foreground"
        }`}
      >
        {selectedId === FLOW_UNCATEGORIZED ? (
          <span className="text-[11px] text-foreground">{uncategorizedLabel}</span>
        ) : (
          <TriggerLabel category={selected} label={allGroupsLabel} />
        )}
        <ChevronDownIcon
          className={`w-3.5 h-3.5 shrink-0 transition-transform text-muted ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("flows.categoryFilter.listAria", "Categories")}
          className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 py-1.5 bg-surface border border-border rounded-xl shadow-2xl max-h-64 overflow-y-auto flow-scrollbar"
        >
          <p className="px-3 pb-1 text-[9px] font-medium uppercase tracking-wider text-muted">
            {t("flows.categoryFilter.title", "Categories")}
          </p>

          <MenuOption selected={selectedId === null} onClick={() => pick(null)}>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-muted text-muted border border-border">
                <Squares2X2Icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-[11px] font-medium">{allGroupsLabel}</span>
            </span>
          </MenuOption>

          {categories.length > 0 && (
            <div className="my-1 mx-2.5 border-t border-border" />
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
              <div className="my-1 mx-2.5 border-t border-border" />
              <MenuOption
                selected={selectedId === FLOW_UNCATEGORIZED}
                onClick={() => pick(FLOW_UNCATEGORIZED)}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-muted text-muted border border-border">
                    <span className="text-[10px] font-bold">?</span>
                  </span>
                  <span className="text-[11px] font-medium text-foreground">{uncategorizedLabel}</span>
                </span>
              </MenuOption>
            </>
          )}
        </div>
      )}
    </div>
  );
}
