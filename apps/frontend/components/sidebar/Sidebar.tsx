"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  UserCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import type { Conversation } from "@/lib/types";
import { createConversation, deleteConversation, fetchConversations, renameConversation } from "@/lib/api";
import { QuotaMeter } from "./QuotaMeter";
import { SIDEBAR_NAV_ITEMS } from "./navVisuals";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";

const SIDEBAR_COLLAPSED_KEY = "omni_sidebar_collapsed";

interface SidebarProps {
  activeConvId?: string;
  onSelectConv?: (id: string) => void;
  onNewConv?: (id: string) => void;
  pendingTitleUpdate?: { id: string; title: string } | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  activeConvId,
  onSelectConv,
  onNewConv,
  pendingTitleUpdate,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated, isAuthReady } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (pathname.startsWith("/agents/flow/") || pathname === "/agents/flow") {
      setCollapsed(true);
      return;
    }
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, [pathname]);

  const setCollapsedPersisted = (next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    if (next) {
      setEditingId(null);
      setEditValue("");
    }
  };

  const toggleCollapsed = () => {
    setCollapsedPersisted(!collapsed);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConversations()
      .then(setConversations)
      .catch(() => {});
  }, [activeConvId, isAuthenticated]);

  useEffect(() => {
    if (!pendingTitleUpdate) return;
    const { id, title } = pendingTitleUpdate;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title || c.title } : c))
    );
  }, [pendingTitleUpdate]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const handleNew = async () => {
    if (!isAuthenticated || loading) return;
    setLoading(true);
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      onMobileClose?.();
      if (onNewConv) {
        onNewConv(conv.id);
      } else {
        router.push(`/chat?c=${conv.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    onMobileClose?.();
    if (onSelectConv) {
      onSelectConv(id);
    } else {
      router.push(`/chat?c=${id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      if (onNewConv) onNewConv("");
      else if (pathname === "/chat") router.push("/chat");
    }
  };

  const startEdit = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title || "");
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditValue("");
  };

  const commitEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      try {
        await renameConversation(editingId, trimmed);
        setConversations((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, title: trimmed } : c))
        );
      } catch {
        // keep old title on error
      }
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  };

  const navLinkClass = (active: boolean, rowActive: string) =>
    `group flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
      collapsed && !mobileOpen ? "justify-center p-2" : "gap-2.5 px-2 py-2"
    } ${
      active
        ? rowActive
        : "text-muted border border-transparent hover:bg-surface-hover hover:text-foreground"
    }`;

  const isDrawerExpanded = mobileOpen || !collapsed;

  return (
    <aside
      className={`flex flex-col h-full bg-sidebar border-r border-gray-700 shrink-0 transition-[width,transform] duration-200 ${
        isDrawerExpanded ? "w-64" : "w-[52px]"
      } max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[min(280px,85vw)] max-md:transition-transform max-md:duration-300 max-md:shadow-xl ${
        mobileOpen ? "max-md:translate-x-0 max-md:pointer-events-auto" : "max-md:-translate-x-full max-md:pointer-events-none"
      } md:relative md:translate-x-0 md:pointer-events-auto`}
    >
      {/* Header */}
      {collapsed && !mobileOpen ? (
        <>
          <div className="flex justify-center py-2 px-1 border-b border-gray-700">
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title={t("layout.sidebar.expand")}
              aria-label={t("layout.sidebar.expand")}
            >
              <ChevronDoubleRightIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-1 py-2 px-1 border-b border-gray-700">
            <Link
              href="/chat"
              className="w-8 h-8 flex items-center justify-center rounded-md text-white font-bold text-xs bg-accent/20 hover:bg-accent/30 transition-colors"
              title={t("app.brand")}
            >
              H
            </Link>
            {isAuthenticated && (
              <button
                onClick={handleNew}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={t("layout.sidebar.newChat")}
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <Link
            href="/chat"
            onClick={() => onMobileClose?.()}
            className="text-white font-semibold text-sm tracking-wide hover:text-gray-200 transition-colors truncate"
          >
            {t("app.brand")}
          </Link>
          <div className="flex items-center gap-0.5">
            {isAuthenticated && (
              <button
                onClick={handleNew}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={t("layout.sidebar.newChat")}
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={toggleCollapsed}
              className="hidden md:inline-flex p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title={t("layout.sidebar.collapse")}
              aria-label={t("layout.sidebar.collapse")}
            >
              <ChevronDoubleLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onMobileClose}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title={t("layout.sidebar.close")}
              aria-label={t("layout.mobile.closeMenu")}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main navigation */}
      <nav className={`py-2 border-b border-gray-700 space-y-1 ${isDrawerExpanded ? "px-2" : "px-1"}`}>
        {SIDEBAR_NAV_ITEMS.map(({ href, labelKey, icon: Icon, match, visual }) => {
          const active = match(pathname);
          const label = t(labelKey);
          const iconBoxSize = isDrawerExpanded ? "w-8 h-8" : "w-9 h-9";
          const iconSize = isDrawerExpanded ? "w-4 h-4" : "w-[18px] h-[18px]";
          return (
            <Link
              key={href}
              href={href}
              title={label}
              onClick={() => onMobileClose?.()}
              className={navLinkClass(active, visual.rowActive)}
            >
              <span
                className={`flex items-center justify-center rounded-lg border shrink-0 transition-all duration-200 group-hover:scale-105 ${
                  iconBoxSize
                } ${active ? visual.boxActive : visual.box}`}
              >
                <Icon
                  className={`${iconSize} transition-colors duration-200 ${
                    active ? visual.iconActive : visual.icon
                  }`}
                />
              </span>
              {isDrawerExpanded && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Conversation list or guest prompt */}
      <div className={`flex-1 overflow-y-auto py-2 space-y-0.5 ${isDrawerExpanded ? "px-2" : "px-1"}`}>
        {!isAuthReady ? (
          isDrawerExpanded && <p className="text-gray-600 text-xs text-center mt-8 px-4">{t("common.loading")}</p>
        ) : !isAuthenticated ? (
          isDrawerExpanded && (
            <div className="mt-8 px-3 space-y-3 text-center">
              <UserCircleIcon className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-gray-500 text-xs leading-relaxed">
                {t("layout.sidebar.guestPrompt")}
              </p>
            </div>
          )
        ) : (
          <>
            {conversations.length === 0 && isDrawerExpanded && (
              <p className="text-gray-500 text-xs text-center mt-8 px-4">
                {t("layout.sidebar.noConversations")}
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => editingId !== conv.id && handleSelectConversation(conv.id)}
                title={conv.title || t("layout.sidebar.newConversation")}
                className={`group w-full flex items-center rounded-lg text-sm text-left transition-colors cursor-pointer ${
                  isDrawerExpanded ? "gap-2 px-3 py-2" : "justify-center p-2.5"
                } ${
                  conv.id === activeConvId
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <ChatBubbleLeftIcon className={`shrink-0 opacity-60 ${isDrawerExpanded ? "w-3.5 h-3.5" : "w-5 h-5"}`} />

                {isDrawerExpanded && (
                  editingId === conv.id ? (
                    <div className="flex flex-1 items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={() => commitEdit()}
                        className="flex-1 min-w-0 bg-gray-600 text-white text-xs rounded px-1.5 py-0.5 outline-none border border-gray-500 focus:border-accent"
                      />
                      <button onClick={(e) => commitEdit(e)} className="p-0.5 text-green-400 hover:text-green-300 shrink-0">
                        <CheckIcon className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => cancelEdit(e)} className="p-0.5 text-gray-500 hover:text-gray-300 shrink-0">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate">
                        {conv.title || t("layout.sidebar.newConversation")}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                        <span
                          onClick={(e) => startEdit(e, conv)}
                          className="p-0.5 rounded hover:text-gray-200 transition-opacity cursor-pointer"
                          title={t("layout.sidebar.rename")}
                        >
                          <PencilIcon className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="p-0.5 rounded hover:text-red-400 transition-opacity cursor-pointer"
                          title={t("layout.sidebar.delete")}
                        >
                          <TrashIcon className="w-3 h-3" />
                        </span>
                      </span>
                    </>
                  )
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      {isAuthenticated && (
        <div className={`border-t border-gray-700 ${isDrawerExpanded ? "px-3 py-3" : "px-1 py-2"}`}>
          <QuotaMeter collapsed={!isDrawerExpanded} />
        </div>
      )}
    </aside>
  );
}
