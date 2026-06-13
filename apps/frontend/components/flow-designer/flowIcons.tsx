import type { ComponentType, SVGProps } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowUpTrayIcon,
  Bars3Icon,
  BoltIcon,
  ChartBarIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  CpuChipIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  PaintBrushIcon,
  PlayIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type FlowIconKey =
  | "input"
  | "agent"
  | "terminal"
  | "sparkles"
  | "trash"
  | "close"
  | "download"
  | "upload"
  | "bolt"
  | "sync"
  | "tune"
  | "save"
  | "play"
  | "settings"
  | "delete"
  | "drag"
  | "copy"
  | "check"
  | "chart-bar"
  | "paint-brush"
  | "layers"
  | "shield-check"
  | "document-text";

const FLOW_ICONS: Record<FlowIconKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  input: ArrowRightEndOnRectangleIcon,
  agent: CpuChipIcon,
  terminal: CommandLineIcon,
  sparkles: SparklesIcon,
  trash: TrashIcon,
  close: XMarkIcon,
  download: ArrowDownTrayIcon,
  upload: ArrowUpTrayIcon,
  bolt: BoltIcon,
  sync: ArrowPathIcon,
  tune: AdjustmentsHorizontalIcon,
  save: DocumentArrowDownIcon,
  play: PlayIcon,
  settings: Cog6ToothIcon,
  delete: TrashIcon,
  drag: Bars3Icon,
  copy: ClipboardDocumentIcon,
  check: CheckIcon,
  "chart-bar": ChartBarIcon,
  "paint-brush": PaintBrushIcon,
  layers: RectangleStackIcon,
  "shield-check": ShieldCheckIcon,
  "document-text": DocumentTextIcon,
};

export function FlowIcon({
  icon,
  className = "w-[18px] h-[18px]",
}: {
  icon: FlowIconKey;
  className?: string;
}) {
  const Icon = FLOW_ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
