import {
  AcademicCapIcon,
  BeakerIcon,
  BoltIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  FilmIcon,
  GlobeAltIcon,
  LightBulbIcon,
  MegaphoneIcon,
  PaintBrushIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType } from "react";
import type { AgentCategory } from "./types";

export type AgentIconKey =
  | "cpu-chip"
  | "sparkles"
  | "code-bracket"
  | "briefcase"
  | "megaphone"
  | "film"
  | "currency-dollar"
  | "globe-alt"
  | "light-bulb"
  | "rocket-launch"
  | "beaker"
  | "chart-bar"
  | "document-text"
  | "paint-brush"
  | "user-group"
  | "shield-check"
  | "wrench-screwdriver"
  | "puzzle-piece"
  | "chat-bubble-left-right"
  | "server-stack"
  | "academic-cap"
  | "bolt";

export interface AgentIconOption {
  key: AgentIconKey;
  label: string;
}

export const AGENT_ICON_OPTIONS: AgentIconOption[] = [
  { key: "cpu-chip", label: "AI / Tech" },
  { key: "sparkles", label: "Magic" },
  { key: "code-bracket", label: "Code" },
  { key: "briefcase", label: "Business" },
  { key: "megaphone", label: "Marketing" },
  { key: "film", label: "Media" },
  { key: "currency-dollar", label: "Commerce" },
  { key: "globe-alt", label: "Global" },
  { key: "light-bulb", label: "Ideas" },
  { key: "rocket-launch", label: "Launch" },
  { key: "beaker", label: "Research" },
  { key: "chart-bar", label: "Analytics" },
  { key: "document-text", label: "Docs" },
  { key: "paint-brush", label: "Design" },
  { key: "user-group", label: "Team" },
  { key: "shield-check", label: "Security" },
  { key: "wrench-screwdriver", label: "Tools" },
  { key: "puzzle-piece", label: "Integration" },
  { key: "chat-bubble-left-right", label: "Chat" },
  { key: "server-stack", label: "System" },
  { key: "academic-cap", label: "Education" },
  { key: "bolt", label: "Speed" },
];

const ICON_MAP: Record<AgentIconKey, ComponentType<{ className?: string }>> = {
  "cpu-chip": CpuChipIcon,
  sparkles: SparklesIcon,
  "code-bracket": CodeBracketIcon,
  briefcase: BriefcaseIcon,
  megaphone: MegaphoneIcon,
  film: FilmIcon,
  "currency-dollar": CurrencyDollarIcon,
  "globe-alt": GlobeAltIcon,
  "light-bulb": LightBulbIcon,
  "rocket-launch": RocketLaunchIcon,
  beaker: BeakerIcon,
  "chart-bar": ChartBarIcon,
  "document-text": DocumentTextIcon,
  "paint-brush": PaintBrushIcon,
  "user-group": UserGroupIcon,
  "shield-check": ShieldCheckIcon,
  "wrench-screwdriver": WrenchScrewdriverIcon,
  "puzzle-piece": PuzzlePieceIcon,
  "chat-bubble-left-right": ChatBubbleLeftRightIcon,
  "server-stack": ServerStackIcon,
  "academic-cap": AcademicCapIcon,
  bolt: BoltIcon,
};

const FALLBACK_ICONS: AgentIconKey[] = [
  "cpu-chip",
  "sparkles",
  "light-bulb",
  "rocket-launch",
  "beaker",
  "puzzle-piece",
  "chat-bubble-left-right",
  "document-text",
];

export function isAgentIconKey(value: string | null | undefined): value is AgentIconKey {
  return !!value && value in ICON_MAP;
}

export function resolveAgentIconKey(
  icon: string | null | undefined,
  name: string,
  categories?: Pick<AgentCategory, "icon">[],
): AgentIconKey {
  if (isAgentIconKey(icon)) return icon;
  const categoryIcon = categories?.find((c) => isAgentIconKey(c.icon))?.icon;
  if (isAgentIconKey(categoryIcon)) return categoryIcon;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % FALLBACK_ICONS.length;
  }
  return FALLBACK_ICONS[hash] ?? "cpu-chip";
}

export function getAgentIconComponent(key: AgentIconKey): ComponentType<{ className?: string }> {
  return ICON_MAP[key] ?? CpuChipIcon;
}

export function getAgentIconLabel(key: AgentIconKey): string {
  return AGENT_ICON_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
