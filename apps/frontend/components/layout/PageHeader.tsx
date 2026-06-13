"use client";

import { MobileMenuButton } from "./MobileMenuButton";
import { AppUserMenu } from "./AppUserMenu";

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  title: string;
  badge?: React.ReactNode;
  /** Rendered between title and action buttons (e.g. category filter). */
  center?: React.ReactNode;
  actions?: React.ReactNode;
  hideUserMenu?: boolean;
}

export function PageHeader({
  icon: Icon,
  iconClassName = "text-blue-400",
  title,
  badge,
  center,
  actions,
  hideUserMenu = false,
}: PageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-gray-700 px-4 sm:px-6 py-3">
      <div
        className={`flex min-w-0 gap-2.5 md:gap-3 ${
          center ? "flex-col md:flex-row md:items-center" : "flex-row items-center"
        }`}
      >
        <div
          className={`flex items-center gap-2 sm:gap-3 min-w-0 ${
            center ? "justify-between md:order-1 md:shrink-0 md:flex-none" : "flex-1"
          }`}
        >
          <MobileMenuButton />
          <Icon className={`w-5 h-5 shrink-0 ${iconClassName}`} />
          <h1
            className={`text-sm font-medium text-gray-300 truncate min-w-0 ${
              center ? "max-w-[9rem] sm:max-w-xs" : ""
            }`}
          >
            {title}
          </h1>
          {badge && <div className="shrink-0 hidden sm:block">{badge}</div>}
        </div>

        {center && (
          <div className="flex justify-center min-w-0 md:order-2 md:flex-1 md:px-2">{center}</div>
        )}

        <div className={`flex items-center justify-end gap-2 shrink-0 ${center ? "md:order-3" : ""}`}>
          {badge && <div className="sm:hidden shrink-0">{badge}</div>}
          {actions}
          {!hideUserMenu && <AppUserMenu />}
        </div>
      </div>
    </header>
  );
}
