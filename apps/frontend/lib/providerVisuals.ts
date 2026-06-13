import {
  BoltIcon,
  GlobeAltIcon,
  CpuChipIcon,
  SparklesIcon,
  ChatBubbleBottomCenterTextIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType } from "react";
import { PROVIDERS } from "./types";

export interface ProviderVisual {
  id: string;
  name: string;
  icon: ComponentType<{ className?: string }>;
  badgeClass: string;
  panelClass: string;
  dotClass: string;
  selectedClass: string;
}

const VISUALS: Record<string, Omit<ProviderVisual, "id" | "name">> = {
  groq: {
    icon: BoltIcon,
    badgeClass: "bg-amber-500/15 text-amber-600 border-amber-500/40",
    panelClass: "bg-amber-500/10 border-amber-500/30",
    dotClass: "bg-amber-400",
    selectedClass: "ring-amber-500/50 border-amber-500/50",
  },
  openrouter: {
    icon: GlobeAltIcon,
    badgeClass: "bg-violet-500/15 text-violet-600 border-violet-500/40",
    panelClass: "bg-violet-500/10 border-violet-500/30",
    dotClass: "bg-violet-400",
    selectedClass: "ring-violet-500/50 border-violet-500/50",
  },
  nvidia: {
    icon: CpuChipIcon,
    badgeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
    panelClass: "bg-emerald-500/10 border-emerald-500/30",
    dotClass: "bg-emerald-400",
    selectedClass: "ring-emerald-500/50 border-emerald-500/50",
  },
  openai: {
    icon: SparklesIcon,
    badgeClass: "bg-teal-500/15 text-teal-600 border-teal-500/40",
    panelClass: "bg-teal-500/10 border-teal-500/30",
    dotClass: "bg-teal-400",
    selectedClass: "ring-teal-500/50 border-teal-500/50",
  },
  anthropic: {
    icon: ChatBubbleBottomCenterTextIcon,
    badgeClass: "bg-orange-500/15 text-orange-600 border-orange-500/40",
    panelClass: "bg-orange-500/10 border-orange-500/30",
    dotClass: "bg-orange-400",
    selectedClass: "ring-orange-500/50 border-orange-500/50",
  },
  google: {
    icon: BeakerIcon,
    badgeClass: "bg-sky-500/15 text-sky-600 border-sky-500/40",
    panelClass: "bg-sky-500/10 border-sky-500/30",
    dotClass: "bg-sky-400",
    selectedClass: "ring-sky-500/50 border-sky-500/50",
  },
};

const FALLBACK: Omit<ProviderVisual, "id" | "name"> = {
  icon: CpuChipIcon,
  badgeClass: "bg-surface-elevated text-muted border-border",
  panelClass: "bg-surface-muted border-border",
  dotClass: "bg-gray-400",
  selectedClass: "ring-gray-500/50 border-gray-500/50",
};

export function getProviderVisual(providerId: string, providerName?: string): ProviderVisual {
  const cfg = PROVIDERS.find((p) => p.id === providerId);
  const base = VISUALS[providerId] ?? FALLBACK;
  return {
    id: providerId,
    name: providerName ?? cfg?.name ?? providerId,
    ...base,
  };
}

export function listProviderVisuals(): ProviderVisual[] {
  return PROVIDERS.map((p) => getProviderVisual(p.id, p.name));
}
