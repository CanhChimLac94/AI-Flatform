"use client";

import { createContext, useContext } from "react";

interface SidebarContextValue {
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  return (
    ctx ?? {
      openMobileSidebar: () => {},
      closeMobileSidebar: () => {},
    }
  );
}

export { SidebarContext };
