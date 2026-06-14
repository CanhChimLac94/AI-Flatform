"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserCircleIcon,
  Cog6ToothIcon,
  LanguageIcon,
  SunIcon,
  MoonIcon,
  ArrowRightStartOnRectangleIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";

function MenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
  href,
  active,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  danger?: boolean;
}) {
  const className = `w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
    danger
      ? "text-red-400 hover:bg-red-900/20"
      : active
        ? "bg-surface-elevated text-foreground"
        : "text-muted hover:bg-surface-hover hover:text-foreground"
  }`;

  const content = (
    <>
      <Icon className="w-4 h-4 shrink-0 opacity-80" />
      <span className="flex-1 min-w-0">{label}</span>
      {hint && <span className="text-[11px] text-muted shrink-0">{hint}</span>}
      {active && <CheckIcon className="w-4 h-4 text-blue-400 shrink-0" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

function MenuSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      {title && (
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

interface AppUserMenuProps {
  /** `floating` — góc phải trên trang không có header (auth). Mặc định: inline trong header. */
  variant?: "inline" | "floating";
}

export function AppUserMenu({ variant = "inline" }: AppUserMenuProps) {
  const router = useRouter();
  const { isAuthenticated, isAuthReady, user, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  const handleLogout = async () => {
    close();
    await logout();
    router.push("/chat");
  };

  const displayName =
    user?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    (isAuthenticated ? t("layout.userMenu.account") : t("layout.userMenu.guest"));

  const wrapperClass =
    variant === "floating"
      ? "fixed top-3 right-3 sm:top-4 sm:right-4 z-[60] pointer-events-none"
      : "relative shrink-0";

  return (
    <div className={wrapperClass}>
      <div ref={rootRef} className={`relative ${variant === "floating" ? "pointer-events-auto" : ""}`}>
        <button
          type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("layout.userMenu.ariaLabel")}
        className={`inline-flex items-center justify-center rounded-xl p-1.5 transition-colors`}
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0">
          <UserCircleIcon className="w-5 h-5 text-blue-400" />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 py-1.5 rounded-xl bg-surface border border-border shadow-2xl z-50"
        >
          {isAuthenticated && user?.email && (
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted truncate mt-0.5">{user.email}</p>
            </div>
          )}

          <MenuSection>
            <MenuItem
              icon={Cog6ToothIcon}
              label={t("layout.userMenu.settings")}
              href="/settings"
              onClick={close}
            />
          </MenuSection>

          <div className="border-t border-border" />

          <MenuSection title={t("layout.userMenu.language")}>
            <MenuItem
              icon={LanguageIcon}
              label={t("layout.userMenu.english")}
              hint="EN"
              active={locale === "en"}
              onClick={() => { setLocale("en"); }}
            />
            <MenuItem
              icon={LanguageIcon}
              label={t("layout.userMenu.vietnamese")}
              hint="VI"
              active={locale === "vi"}
              onClick={() => { setLocale("vi"); }}
            />
          </MenuSection>

          <div className="border-t border-border" />

          <MenuSection title={t("layout.userMenu.theme")}>
            <MenuItem
              icon={MoonIcon}
              label={t("layout.userMenu.dark")}
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
            />
            <MenuItem
              icon={SunIcon}
              label={t("layout.userMenu.light")}
              active={theme === "light"}
              onClick={() => setTheme("light")}
            />
          </MenuSection>

          <div className="border-t border-border" />

          <MenuSection>
            {isAuthenticated ? (
              <MenuItem
                icon={ArrowRightStartOnRectangleIcon}
                label={t("layout.userMenu.logout")}
                danger
                onClick={() => void handleLogout()}
              />
            ) : (
              <>
                <MenuItem
                  icon={UserCircleIcon}
                  label={t("layout.userMenu.login")}
                  href="/auth/login"
                  onClick={close}
                />
                <MenuItem
                  icon={UserCircleIcon}
                  label={t("layout.userMenu.register")}
                  href="/auth/register"
                  onClick={close}
                />
              </>
            )}
          </MenuSection>
        </div>
      )}
      </div>
    </div>
  );
}
