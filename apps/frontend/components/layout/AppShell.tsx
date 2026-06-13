"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { SidebarContext } from "./SidebarContext";
import { useI18n } from "@/contexts/I18nContext";

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
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileSidebar = () => setMobileOpen(false);
  const openMobileSidebar = () => setMobileOpen(true);

  return (
    <SidebarContext.Provider value={{ openMobileSidebar, closeMobileSidebar }}>
      <div className="flex h-dvh overflow-hidden bg-chat-bg">
        {mobileOpen && (
          <button
            type="button"
            aria-label={t("layout.mobile.closeMenu")}
            className="fixed inset-0 z-40 bg-overlay md:hidden"
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
