"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";
import { useSidebar } from "./SidebarContext";

interface MobileMenuButtonProps {
  className?: string;
}

export function MobileMenuButton({
  className = "md:hidden p-1.5 -ml-1 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors shrink-0",
}: MobileMenuButtonProps) {
  const { openMobileSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={openMobileSidebar}
      className={className}
      aria-label="Open menu"
    >
      <Bars3Icon className="w-5 h-5" />
    </button>
  );
}
