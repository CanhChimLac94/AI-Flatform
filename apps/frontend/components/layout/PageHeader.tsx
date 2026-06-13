"use client";

import { MobileMenuButton } from "./MobileMenuButton";

interface PageHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ icon: Icon, iconClassName = "text-blue-400", title, badge, actions }: PageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-gray-700 px-4 sm:px-6 py-3 space-y-3">
      <div className="flex items-center gap-3 min-w-0">
        <MobileMenuButton />
        <Icon className={`w-5 h-5 shrink-0 ${iconClassName}`} />
        <h1 className="text-sm font-medium text-gray-300 truncate flex-1 min-w-0">{title}</h1>
        {badge && <div className="shrink-0 hidden sm:block">{badge}</div>}
      </div>
      {(actions || badge) && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {badge && <div className="sm:hidden shrink-0">{badge}</div>}
          {actions}
        </div>
      )}
    </header>
  );
}
