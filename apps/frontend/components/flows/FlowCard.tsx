"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  Squares2X2Icon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  PlayIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import type { AgentFlowSummary } from "@/lib/types";
import { useHasMounted } from "@/hooks/useHasMounted";

interface Props {
  flow: AgentFlowSummary;
  showSchedule?: boolean;
  isRunning?: boolean;
  onEdit: (flow: AgentFlowSummary) => void;
  onDelete: (flow: AgentFlowSummary) => void;
  onDuplicate: (flow: AgentFlowSummary) => void;
  onSchedule?: (flow: AgentFlowSummary) => void;
  onRun?: (flow: AgentFlowSummary) => void;
  onViewResults?: (flow: AgentFlowSummary) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
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

function scheduleLabel(flow: AgentFlowSummary): string | null {
  if (!flow.schedule_enabled) return null;
  if (flow.next_run_at) {
    return `Lịch: ${new Date(flow.next_run_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}`;
  }
  return "Lịch: đã bật";
}

const STATUS_COLORS: Record<string, string> = {
  success: "text-emerald-400",
  failed: "text-red-400",
  running: "text-amber-400",
};

const STATUS_LABEL: Record<string, string> = {
  success: "Thành công",
  failed: "Lỗi",
  running: "Đang chạy",
};

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
      : "text-gray-300 hover:bg-gray-700 hover:text-white"
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
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
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
  onEdit,
  onDelete,
  onDuplicate,
  onSchedule,
  onRun,
  onViewResults,
}: Props) {
  const mounted = useHasMounted();
  const scheduleText = mounted ? scheduleLabel(flow) : null;
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
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/agents/flow/${flow.id}`}
          className="flex-1 min-w-0 group"
          title="Mở Flow Designer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700/80 border border-gray-600 shrink-0 group-hover:border-indigo-500/50 transition-colors">
              <Squares2X2Icon className="w-4 h-4 text-indigo-300" />
            </div>
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-indigo-200 transition-colors">
              {flow.name}
            </h3>
          </div>
          {flow.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{flow.description}</p>
          )}
          {scheduleText && (
            <p className="text-[11px] text-indigo-300/90 mt-1 flex items-center gap-1" suppressHydrationWarning>
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
                ? "bg-gray-700 border-gray-600 text-white"
                : "border-transparent text-gray-500 hover:text-white hover:bg-gray-700"
            }`}
            aria-label="Tùy chọn flow"
            aria-expanded={menuOpen}
          >
            <EllipsisVerticalIcon className={`w-5 h-5 ${isRunning ? "text-emerald-400 animate-pulse" : ""}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-52 py-1 rounded-xl bg-gray-900 border border-gray-700 shadow-xl">
              {showSchedule && (
                <MenuSection title="Thực thi">
                  {onRun && (
                    <MenuItem
                      icon={PlayIcon}
                      label={isRunning ? "Đang chạy..." : "Chạy ngay"}
                      iconClassName="text-emerald-400"
                      disabled={isRunning}
                      onClick={() => closeAnd(() => onRun(flow))}
                    />
                  )}
                  {onViewResults && (
                    <MenuItem
                      icon={DocumentTextIcon}
                      label="Xem kết quả"
                      iconClassName="text-sky-400"
                      onClick={() => closeAnd(() => onViewResults(flow))}
                    />
                  )}
                  {onSchedule && (
                    <MenuItem
                      icon={ClockIcon}
                      label="Đặt lịch chạy"
                      iconClassName="text-indigo-400"
                      onClick={() => closeAnd(() => onSchedule(flow))}
                    />
                  )}
                </MenuSection>
              )}

              <MenuSection title="Flow">
                <MenuItem
                  icon={ArrowTopRightOnSquareIcon}
                  label="Mở Flow Designer"
                  href={`/agents/flow/${flow.id}`}
                  onClick={() => setMenuOpen(false)}
                />
                <MenuItem
                  icon={PencilIcon}
                  label="Sửa thông tin"
                  onClick={() => closeAnd(() => onEdit(flow))}
                />
                <MenuItem
                  icon={DocumentDuplicateIcon}
                  label="Nhân bản"
                  onClick={() => closeAnd(() => onDuplicate(flow))}
                />
              </MenuSection>

              <div className="border-t border-gray-700/80 py-1">
                <MenuItem
                  icon={TrashIcon}
                  label="Xóa flow"
                  danger
                  onClick={() => closeAnd(() => onDelete(flow))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="bg-gray-700/80 text-gray-300 px-2 py-0.5 rounded-full">
          {flow.node_count} node
        </span>
        <span className="bg-gray-700/80 text-gray-300 px-2 py-0.5 rounded-full">
          {flow.edge_count} kết nối
        </span>
        {flow.last_run_status && (
          <button
            type="button"
            onClick={() => showSchedule && onViewResults && closeAnd(() => onViewResults(flow))}
            className={`px-2 py-0.5 rounded-full bg-gray-700/50 hover:bg-gray-700 transition-colors ${
              STATUS_COLORS[flow.last_run_status] ?? "text-gray-400"
            } ${showSchedule && onViewResults ? "cursor-pointer" : "cursor-default"}`}
            title={showSchedule && onViewResults ? "Xem kết quả lần chạy gần nhất" : undefined}
          >
            {STATUS_LABEL[flow.last_run_status] ?? flow.last_run_status}
          </button>
        )}
        <span className="text-gray-600 ml-auto" suppressHydrationWarning>
          {mounted ? formatDate(flow.updated_at) : "—"}
        </span>
      </div>
    </div>
  );
}
