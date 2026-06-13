"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  CpuChipIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  Squares2X2Icon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ArrowRightStartOnRectangleIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import type { Conversation } from "@/lib/types";
import { createConversation, deleteConversation, fetchConversations, renameConversation } from "@/lib/api";
import { QuotaMeter } from "./QuotaMeter";
import { useAuth } from "@/contexts/AuthContext";

const SIDEBAR_COLLAPSED_KEY = "omni_sidebar_collapsed";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: ChatBubbleLeftIcon, match: (path: string) => path === "/chat" },
  { href: "/settings", label: "Settings", icon: Cog6ToothIcon, match: (path: string) => path === "/settings" },
  {
    href: "/agents",
    label: "Agents",
    icon: CpuChipIcon,
    match: (path: string) => path === "/agents",
  },
  {
    href: "/agents/system",
    label: "Thư viện",
    icon: ServerStackIcon,
    match: (path: string) => path.startsWith("/agents/system"),
  },
  {
    href: "/agents/flows",
    label: "Flow",
    icon: Squares2X2Icon,
    match: (path: string) => path.startsWith("/agents/flow") || path === "/agents/flows",
  },
] as const;

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
  const { isAuthenticated, isAuthReady, logout } = useAuth();

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

  const navLinkClass = (active: boolean) =>
    `flex items-center rounded-lg text-sm transition-colors ${
      collapsed && !mobileOpen ? "justify-center p-2.5" : "gap-2 px-3 py-2"
    } ${
      active
        ? "bg-gray-700 text-white"
        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
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
              title="Mở rộng menu"
              aria-label="Expand sidebar"
            >
              <ChevronDoubleRightIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-1 py-2 px-1 border-b border-gray-700">
            <Link
              href="/chat"
              className="w-8 h-8 flex items-center justify-center rounded-md text-white font-bold text-xs bg-accent/20 hover:bg-accent/30 transition-colors"
              title="AI Hub"
            >
              H
            </Link>
            {isAuthenticated && (
              <button
                onClick={handleNew}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="New chat"
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
            AI Hub
          </Link>
          <div className="flex items-center gap-0.5">
            {isAuthenticated && (
              <button
                onClick={handleNew}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title="New chat"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={toggleCollapsed}
              className="hidden md:inline-flex p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Thu nhỏ menu"
              aria-label="Collapse sidebar"
            >
              <ChevronDoubleLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onMobileClose}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Đóng menu"
              aria-label="Close menu"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main navigation */}
      <nav className={`py-2 border-b border-gray-700 space-y-0.5 ${isDrawerExpanded ? "px-2" : "px-1"}`}>
        {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              onClick={() => onMobileClose?.()}
              className={navLinkClass(active)}
            >
              <Icon className={`shrink-0 opacity-60 ${isDrawerExpanded ? "w-3.5 h-3.5" : "w-5 h-5"}`} />
              {isDrawerExpanded && label}
            </Link>
          );
        })}
      </nav>

      {/* Conversation list or guest prompt */}
      <div className={`flex-1 overflow-y-auto py-2 space-y-0.5 ${isDrawerExpanded ? "px-2" : "px-1"}`}>
        {!isAuthReady ? (
          isDrawerExpanded && <p className="text-gray-600 text-xs text-center mt-8 px-4">Loading…</p>
        ) : !isAuthenticated ? (
          collapsed && !mobileOpen ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Link
                href="/auth/login"
                onClick={() => onMobileClose?.()}
                className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                title="Đăng nhập"
              >
                <UserCircleIcon className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <div className="mt-8 px-3 space-y-3 text-center">
              <UserCircleIcon className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-gray-500 text-xs leading-relaxed">
                Đăng nhập để lưu lịch sử hội thoại, đồng bộ cài đặt và tạo agents cá nhân.
              </p>
              <Link
                href="/auth/login"
                onClick={() => onMobileClose?.()}
                className="block w-full bg-accent hover:bg-accent-hover text-white text-xs py-2 rounded-lg transition-colors text-center"
              >
                Đăng nhập
              </Link>
              <Link
                href="/auth/register"
                onClick={() => onMobileClose?.()}
                className="block w-full border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white text-xs py-2 rounded-lg transition-colors text-center"
              >
                Tạo tài khoản
              </Link>
            </div>
          )
        ) : (
          <>
            {conversations.length === 0 && isDrawerExpanded && (
              <p className="text-gray-500 text-xs text-center mt-8 px-4">
                No conversations yet. Start chatting!
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => editingId !== conv.id && handleSelectConversation(conv.id)}
                title={conv.title || "New conversation"}
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
                        {conv.title || "New conversation"}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                        <span
                          onClick={(e) => startEdit(e, conv)}
                          className="p-0.5 rounded hover:text-gray-200 transition-opacity cursor-pointer"
                          title="Rename"
                        >
                          <PencilIcon className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => handleDelete(e, conv.id)}
                          className="p-0.5 rounded hover:text-red-400 transition-opacity cursor-pointer"
                          title="Delete"
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
        <div className={`border-t border-gray-700 space-y-2 ${isDrawerExpanded ? "px-3 py-3" : "px-1 py-2"}`}>
          <button
            onClick={() => void logout()}
            title="Sign out"
            className={`flex items-center w-full rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors ${
              isDrawerExpanded ? "gap-2 px-3 py-2 text-xs" : "justify-center p-2.5"
            }`}
          >
            <ArrowRightStartOnRectangleIcon className={`shrink-0 ${isDrawerExpanded ? "w-4 h-4" : "w-5 h-5"}`} />
            {isDrawerExpanded && <span>Sign out</span>}
          </button>
          <QuotaMeter collapsed={!isDrawerExpanded} />
        </div>
      )}
    </aside>
  );
}
