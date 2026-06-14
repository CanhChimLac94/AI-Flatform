"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  Squares2X2Icon,
  ClockIcon,
  PlayIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import type { AgentFlowSummary } from "@/lib/types";
import { useHasMounted } from "@/hooks/useHasMounted";
import { useI18n } from "@/contexts/I18nContext";

interface Props {
  flow: AgentFlowSummary;
  showSchedule?: boolean;
  isRunning?: boolean;
  onDelete: (flow: AgentFlowSummary) => void;
  onDuplicate: (flow: AgentFlowSummary) => void;
  onSchedule?: (flow: AgentFlowSummary) => void;
  onRun?: (flow: AgentFlowSummary) => void;
  onViewResults?: (flow: AgentFlowSummary) => void;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function scheduleLabel(flow: AgentFlowSummary, locale: string, t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string): string | null {
  if (!flow.schedule_enabled) return null;
  if (flow.next_run_at) {
    const time = new Date(flow.next_run_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
    return t("flows.card.scheduleAt", "Schedule: {time}", { time });
  }
  return t("flows.card.scheduleEnabled", "Schedule: enabled");
}

const STATUS_COLORS: Record<string, string> = {
  success: "text-emerald-500",
  failed: "text-red-500",
  running: "text-amber-500",
};

function statusLabel(
  status: string,
  t: (key: string, fallback?: string) => string,
): string {
  const labels: Record<string, string> = {
    success: t("flows.status.success", "Success"),
    failed: t("flows.status.failed", "Failed"),
    running: t("flows.status.running", "Running"),
  };
  return labels[status] ?? status;
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  href,
  danger,
  disabled,
  iconClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  iconClassName?: string;
}) {
  const className = `w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
    danger
      ? "text-red-400 hover:bg-red-900/20"
      : "text-muted hover:bg-surface-hover hover:text-foreground"
  }`;

  const content = (
    <>
      <Icon className={`w-4 h-4 shrink-0 ${iconClassName ?? ""}`} />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

export function FlowCard({
  flow,
  showSchedule = false,
  isRunning = false,
  onDelete,
  onDuplicate,
  onSchedule,
  onRun,
  onViewResults,
}: Props) {
  const mounted = useHasMounted();
  const { t, locale } = useI18n();
  const scheduleText = mounted ? scheduleLabel(flow, locale, t) : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  const closeAnd = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/agents/flow/${flow.id}`}
          className="flex-1 min-w-0 group"
          title={t("flows.openDesigner")}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-elevated border border-border shrink-0 group-hover:border-indigo-500/50 transition-colors">
              <Squares2X2Icon className="w-4 h-4 text-indigo-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-indigo-500 transition-colors">
              {flow.name}
            </h3>
          </div>
          {flow.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2">{flow.description}</p>
          )}
          {scheduleText && (
            <p className="text-[11px] text-indigo-500 mt-1 flex items-center gap-1" suppressHydrationWarning>
              <ClockIcon className="w-3.5 h-3.5 shrink-0" />
              {scheduleText}
            </p>
          )}
        </Link>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${
              menuOpen
                ? "bg-surface-elevated border-border text-foreground"
                : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
            aria-label={t("flows.manage")}
            aria-expanded={menuOpen}
          >
            <EllipsisVerticalIcon className={`w-5 h-5 ${isRunning ? "text-emerald-500 animate-pulse" : ""}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-52 py-1 rounded-xl bg-surface border border-border shadow-xl">
              {showSchedule && (
                <MenuSection title={t("flows.sectionRun")}>
                  {onRun && (
                    <MenuItem
                      icon={PlayIcon}
                      label={isRunning ? t("flows.running") : t("flows.runNow")}
                      iconClassName="text-emerald-500"
                      disabled={isRunning}
                      onClick={() => closeAnd(() => onRun(flow))}
                    />
                  )}
                  {onViewResults && (
                    <MenuItem
                      icon={DocumentTextIcon}
                      label={t("flows.viewResults")}
                      iconClassName="text-sky-500"
                      onClick={() => closeAnd(() => onViewResults(flow))}
                    />
                  )}
                  {onSchedule && (
                    <MenuItem
                      icon={ClockIcon}
                      label={t("flows.schedule")}
                      iconClassName="text-indigo-500"
                      onClick={() => closeAnd(() => onSchedule(flow))}
                    />
                  )}
                </MenuSection>
              )}

              <MenuSection title={t("flows.sectionFlow", "Flow")}>
                <MenuItem
                  icon={PencilIcon}
                  label={t("flows.editInfo")}
                  href={`/agents/flow/${flow.id}?edit=info`}
                  onClick={() => setMenuOpen(false)}
                />
                <MenuItem
                  icon={DocumentDuplicateIcon}
                  label={t("flows.duplicate")}
                  onClick={() => closeAnd(() => onDuplicate(flow))}
                />
              </MenuSection>

              <div className="border-t border-border py-1">
                <MenuItem
                  icon={TrashIcon}
                  label={t("flows.delete")}
                  danger
                  onClick={() => closeAnd(() => onDelete(flow))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="bg-surface-elevated text-muted px-2 py-0.5 rounded-full border border-border">
          {flow.node_count} {t("flows.nodeLabel", "nodes")}
        </span>
        <span className="bg-surface-elevated text-muted px-2 py-0.5 rounded-full border border-border">
          {flow.edge_count} {t("flows.connectionLabel", "connections")}
        </span>
        {flow.last_run_status && (
          <button
            type="button"
            onClick={() => showSchedule && onViewResults && closeAnd(() => onViewResults(flow))}
            className={`px-2 py-0.5 rounded-full bg-surface-elevated border border-border hover:bg-surface-hover transition-colors ${
              STATUS_COLORS[flow.last_run_status] ?? "text-muted"
            } ${showSchedule && onViewResults ? "cursor-pointer" : "cursor-default"}`}
            title={showSchedule && onViewResults ? t("flows.viewResultsLatest") : undefined}
          >
            {statusLabel(flow.last_run_status, t)}
          </button>
        )}
        <span className="text-muted ml-auto" suppressHydrationWarning>
          {mounted ? formatDate(flow.updated_at, locale) : "—"}
        </span>
      </div>
    </div>
  );
}
