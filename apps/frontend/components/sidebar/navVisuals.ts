import {
  ChatBubbleLeftIcon,
  CpuChipIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { ComponentType } from "react";

export interface NavItemVisual {
  box: string;
  boxActive: string;
  icon: string;
  iconActive: string;
  rowActive: string;
}

export interface NavItemConfig {
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
  visual: NavItemVisual;
}

export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  {
    href: "/chat",
    labelKey: "nav.chat",
    icon: ChatBubbleLeftIcon,
    match: (path) => path === "/chat",
    visual: {
      box: "bg-sky-500/15 border-sky-500/30",
      boxActive: "bg-sky-500/25 border-sky-500/50 shadow-sm shadow-sky-500/20",
      icon: "text-sky-600 dark:text-sky-400",
      iconActive: "text-sky-700 dark:text-sky-300",
      rowActive:
        "bg-sky-500/10 border border-sky-500/25 text-foreground dark:bg-sky-500/15 dark:border-sky-500/30",
    },
  },
  {
    href: "/agents",
    labelKey: "nav.agents",
    icon: CpuChipIcon,
    match: (path) => path === "/agents",
    visual: {
      box: "bg-violet-500/15 border-violet-500/30",
      boxActive: "bg-violet-500/25 border-violet-500/50 shadow-sm shadow-violet-500/20",
      icon: "text-violet-600 dark:text-violet-400",
      iconActive: "text-violet-700 dark:text-violet-300",
      rowActive:
        "bg-violet-500/10 border border-violet-500/25 text-foreground dark:bg-violet-500/15 dark:border-violet-500/30",
    },
  },
  {
    href: "/agents/flows",
    labelKey: "nav.flow",
    icon: Squares2X2Icon,
    match: (path) => path.startsWith("/agents/flow") || path === "/agents/flows",
    visual: {
      box: "bg-emerald-500/15 border-emerald-500/30",
      boxActive: "bg-emerald-500/25 border-emerald-500/50 shadow-sm shadow-emerald-500/20",
      icon: "text-emerald-600 dark:text-emerald-400",
      iconActive: "text-emerald-700 dark:text-emerald-300",
      rowActive:
        "bg-emerald-500/10 border border-emerald-500/25 text-foreground dark:bg-emerald-500/15 dark:border-emerald-500/30",
    },
  },
];
