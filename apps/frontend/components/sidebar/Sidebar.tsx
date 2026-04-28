"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PlusIcon, TrashIcon, ChatBubbleLeftIcon,
  Cog6ToothIcon, UserCircleIcon, CpuChipIcon, PencilIcon, CheckIcon, XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Conversation } from "@/lib/types";
import { createConversation, deleteConversation, fetchConversations, renameConversation } from "@/lib/api";
import { QuotaMeter } from "./QuotaMeter";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  activeConvId?: string;
  onSelectConv: (id: string) => void;
  onNewConv: (id: string) => void;
  /** When a title update arrives via SSE, page passes it here to update sidebar state */
  pendingTitleUpdate?: { id: string; title: string } | null;
}

export function Sidebar({ activeConvId, onSelectConv, onNewConv, pendingTitleUpdate }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConversations()
      .then(setConversations)
      .catch(() => {});
  }, [activeConvId, isAuthenticated]);

  // Apply external title updates from SSE conv_update events
  useEffect(() => {
    if (!pendingTitleUpdate) return;
    const { id, title } = pendingTitleUpdate;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title || c.title } : c))
    );
  }, [pendingTitleUpdate]);

  // Focus the rename input when edit mode activates
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const handleNew = async () => {
    if (!isAuthenticated || loading) return;
    setLoading(true);
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      onNewConv(conv.id);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) onNewConv("");
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

  return (
    <aside className="flex flex-col w-64 h-full bg-sidebar border-r border-gray-700 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-white font-semibold text-sm tracking-wide">Omni AI</span>
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

      {/* Conversation list or guest prompt */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {!isAuthenticated ? (
          <div className="mt-8 px-3 space-y-3 text-center">
            <UserCircleIcon className="w-10 h-10 text-gray-600 mx-auto" />
            <p className="text-gray-500 text-xs leading-relaxed">
              Đăng nhập để lưu lịch sử hội thoại, đồng bộ cài đặt và tạo agents cá nhân.
            </p>
            <Link
              href="/auth/login"
              className="block w-full bg-accent hover:bg-accent-hover text-white text-xs py-2 rounded-lg transition-colors text-center"
            >
              Đăng nhập
            </Link>
            <Link
              href="/auth/register"
              className="block w-full border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white text-xs py-2 rounded-lg transition-colors text-center"
            >
              Tạo tài khoản
            </Link>
          </div>
        ) : (
          <>
            {conversations.length === 0 && (
              <p className="text-gray-500 text-xs text-center mt-8 px-4">
                No conversations yet. Start chatting!
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => editingId !== conv.id && onSelectConv(conv.id)}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                  conv.id === activeConvId
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <ChatBubbleLeftIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />

                {editingId === conv.id ? (
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
                )}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-700 px-4 py-3 space-y-3">
        {isAuthenticated && <QuotaMeter />}
        <div className="flex items-center justify-between">
          {/* Settings link — available to both authenticated users and guests */}
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Cog6ToothIcon className="w-3.5 h-3.5" />
              Settings
            </Link>
            <Link
              href="/agents"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <CpuChipIcon className="w-3.5 h-3.5" />
              Agents
            </Link>
          </div>
          {isAuthenticated && (
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
