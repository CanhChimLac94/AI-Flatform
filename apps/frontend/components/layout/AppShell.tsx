"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { SidebarContext } from "./SidebarContext";

interface AppShellProps {
  children: React.ReactNode;
  sidebarProps?: {
    activeConvId?: string;
    onSelectConv?: (id: string) => void;
    onNewConv?: (id: string) => void;
    pendingTitleUpdate?: { id: string; title: string } | null;
  };
}

export function AppShell({ children, sidebarProps }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileSidebar = () => setMobileOpen(false);
  const openMobileSidebar = () => setMobileOpen(true);

  return (
    <SidebarContext.Provider value={{ openMobileSidebar, closeMobileSidebar }}>
      <div className="flex h-dvh overflow-hidden bg-chat-bg">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closeMobileSidebar}
          />
        )}
        <Sidebar
          {...sidebarProps}
          mobileOpen={mobileOpen}
          onMobileClose={closeMobileSidebar}
        />
        <div className="flex flex-col flex-1 min-w-0 min-h-0">{children}</div>
      </div>
    </SidebarContext.Provider>
  );
}
