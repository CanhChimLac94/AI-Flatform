# Collected Files - frontend

> **Nguồn:** `/mnt/d/01.WORKS/WWW/AI-Projects/AIChat/apps/frontend`
> **Bộ lọc:** chỉ collect source/config/script text; bỏ qua dependency, env, build cache, media và binary

---

## `.dockerignore`

```dockerignore
node_modules/
.next/
out/
.env
.env.*
!.env.local.example
*.log
.DS_Store
Thumbs.db
.git/
.gitignore
Dockerfile
*.md

```

---

## `.env.local.example`

```example
NEXT_PUBLIC_API_URL=http://localhost:8000/v1

```

---

## `Dockerfile`

```WORKS/WWW/AI-Projects/AIChat/apps/frontend/Dockerfile
# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Pin pnpm via npm — avoids corepack needing a packageManager field or network fetch
RUN npm install -g pnpm@9

COPY package.json ./
# Copy lockfile only if it exists; --no-frozen-lockfile handles either case
COPY pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# BACKEND_URL is server-only (used by next.config.ts rewrites, never sent to browser)
# NEXT_PUBLIC_API_URL is no longer needed — browser always calls relative /api/*
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL

RUN pnpm build && mkdir -p /app/public

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]

```

---

## `app/.well-known/appspecific/com.chrome.devtools.json/route.ts`

```ts
export async function GET() {
  return new Response(null, { status: 204 });
}

```

---

## `app/agents/page.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon, ArrowLeftIcon, CpuChipIcon } from "@heroicons/react/24/outline";
import type { Agent, AgentCreateRequest, AgentUpdateRequest } from "@/lib/types";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentForm } from "@/components/agents/AgentForm";
import { useAuth } from "@/contexts/AuthContext";
import {
  listAgents, createAgent, updateAgent, deleteAgent, duplicateAgent,
} from "@/lib/api";
import {
  loadGuestAgents, createGuestAgent, updateGuestAgent,
  deleteGuestAgent, duplicateGuestAgent,
} from "@/lib/agentStore";

type FormMode = { type: "create" } | { type: "edit"; agent: Agent } | null;

export default function AgentsPage() {
  const { isAuthenticated } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        setAgents(await listAgents());
      } else {
        setAgents(loadGuestAgents());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = useCallback(async (data: AgentCreateRequest | AgentUpdateRequest) => {
    if (formMode?.type === "edit") {
      const id = formMode.agent.id;
      if (isAuthenticated) {
        const updated = await updateAgent(id, data as AgentUpdateRequest);
        setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      } else {
        const updated = updateGuestAgent(id, data);
        if (updated) setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
    } else {
      if (isAuthenticated) {
        const created = await createAgent(data as AgentCreateRequest);
        setAgents((prev) => [created, ...prev]);
      } else {
        const created = createGuestAgent({
          ...(data as AgentCreateRequest),
          system_prompt: (data as AgentCreateRequest).system_prompt ?? "",
          params: {},
          tools: data.tools ?? [],
          is_public: data.is_public ?? false,
        });
        setAgents((prev) => [created, ...prev]);
      }
    }
    setFormMode(null);
  }, [formMode, isAuthenticated]);

  const handleDuplicate = useCallback(async (agent: Agent) => {
    try {
      if (isAuthenticated) {
        const copy = await duplicateAgent(agent.id);
        setAgents((prev) => [copy, ...prev]);
      } else {
        const copy = duplicateGuestAgent(agent.id);
        if (copy) setAgents((prev) => [copy, ...prev]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    }
  }, [isAuthenticated]);

  const handleDelete = useCallback(async (agent: Agent) => {
    try {
      if (isAuthenticated) {
        await deleteAgent(agent.id);
      } else {
        deleteGuestAgent(agent.id);
      }
      setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteConfirm(null);
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <CpuChipIcon className="w-5 h-5 text-blue-400" />
              <h1 className="text-base font-semibold">Agents</h1>
            </div>
            {!isAuthenticated && (
              <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-full">
                Guest — saved locally
              </span>
            )}
          </div>
          <button
            onClick={() => setFormMode({ type: "create" })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New agent
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-24 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center">
              <CpuChipIcon className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <p className="text-gray-300 font-medium">No agents yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Create a custom agent with its own system prompt, model, and tools.
              </p>
            </div>
            <button
              onClick={() => setFormMode({ type: "create" })}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Create your first agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={(a) => setFormMode({ type: "edit", agent: a })}
                onDelete={(a) => setDeleteConfirm(a)}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit modal */}
      {formMode && (
        <AgentForm
          initial={formMode.type === "edit" ? formMode.agent : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setFormMode(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-2">Delete agent?</h2>
            <p className="text-sm text-gray-400 mb-6">
              <span className="text-white font-medium">{deleteConfirm.name}</span> will be permanently deleted.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

```

---

## `app/auth/login/page.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-chat-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to Omni AI Chat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          No account?{" "}
          <Link href="/auth/register" className="text-accent hover:text-accent-hover">
            Create one
          </Link>
        </p>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-chat-bg px-2 text-gray-500">hoặc</span>
          </div>
        </div>

        <Link
          href="/chat"
          className="block w-full text-center border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white py-3 rounded-xl text-sm transition-colors"
        >
          Tiếp tục không cần đăng nhập
        </Link>
      </div>
    </div>
  );
}

```

---

## `app/auth/register/page.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, name, password);
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-chat-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-gray-400 text-sm mt-1">Join Omni AI Chat — free to start</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full bg-input-bg border border-gray-600 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Get started"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

```

---

## `app/chat/page.tsx`

```tsx
"use client";

// STEP 5.1-5.3: Main 3-column chat page
// Layout: Sidebar | Chat Window | (Citation panel slides in on [n] click)

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MessageList } from "@/components/chat/MessageList";
import { ModelBadge } from "@/components/chat/ModelBadge";
import { ProviderModelSelector } from "@/components/chat/ProviderModelSelector";
import { SmartInputBar } from "@/components/input/SmartInputBar";
import { AgentSelector } from "@/components/agents/AgentSelector";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import type { Agent } from "@/lib/types";
import { listAgents, getUserSettings, assignAgentToConversation } from "@/lib/api";
import { loadGuestAgents } from "@/lib/agentStore";

export default function ChatPage() {
  const { isAuthenticated } = useAuth();
  const [convId, setConvId] = useState<string | undefined>(undefined);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<string>("");
    const [selectedModel, setSelectedModel] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);

  const { messages, sendMessage, stop, clearMessages } = useChat(convId, activeAgentId);

  // Load agents list and user default provider/model on mount
  useEffect(() => {
    if (isAuthenticated) {
      listAgents().then(setAgents).catch(() => setAgents([]));
      getUserSettings()
        .then((s) => {
          if (s.default_provider) setSelectedProvider(s.default_provider);
          if (s.default_model) setSelectedModel(s.default_model);
        })
        .catch(() => {/* keep empty — provider selector will pick first available */});
    } else {
      setAgents(loadGuestAgents());
    }
  }, [isAuthenticated]);

  // Derive active model from the last assistant message
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const activeProvider = lastAssistant?.metadata?.provider;
  const activeModel = lastAssistant?.metadata?.model;

  const handleSelectConv = useCallback((id: string) => {
    setConvId(id);
    setActiveAgentId(null);
    clearMessages();
  }, [clearMessages]);

  const handleNewConv = useCallback((id: string) => {
    setConvId(id || undefined);
    setActiveAgentId(null);
    clearMessages();
  }, [clearMessages]);

  const handleSend = useCallback(
    (content: string, model: "auto" | "speed" | "quality", tools: string[], attachments: string[]) => {
      sendMessage(content, model, tools, attachments, selectedProvider || undefined, selectedModel || undefined);
    },
    [sendMessage, selectedProvider, selectedModel]
  );

  const handleSelectAgent = useCallback(async (agentId: string | null) => {
    setActiveAgentId(agentId);
    // Persist agent assignment on the conversation when authenticated
    if (isAuthenticated && convId) {
      try {
        await assignAgentToConversation(convId, agentId);
      } catch {
        // Non-critical — agent will still be applied via req.agent_id
      }
    }
  }, [isAuthenticated, convId]);

  const isCurrentlyStreaming = messages.some((m) => m.isStreaming);

  return (
    <div className="flex h-screen overflow-hidden bg-chat-bg">
      {/* Left Sidebar (AiChat-UIUX-Wireframe §I) */}
      <Sidebar
        activeConvId={convId}
        onSelectConv={handleSelectConv}
        onNewConv={handleNewConv}
      />

      {/* Main Chat Window */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-700 shrink-0 gap-3">
          <h1 className="text-sm font-medium text-gray-300 truncate">
            {convId ? "Conversation" : "New conversation"}
          </h1>
                    <ProviderModelSelector
                      selectedProvider={selectedProvider}
                      selectedModel={selectedModel}
                      onProviderChange={setSelectedProvider}
                      onModelChange={setSelectedModel}
                      disabled={isCurrentlyStreaming}
                    />
          <div className="flex items-center gap-2">
            <AgentSelector
              agents={agents}
              activeAgentId={activeAgentId}
              onSelect={handleSelectAgent}
            />
            <ModelBadge model={activeModel} provider={activeProvider} />
          </div>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          onRegenerate={(msgId) => {
            const msg = messages.find((m) => m.id === msgId);
            if (msg) sendMessage(msg.content);
          }}
        />

        {/* Smart Input Bar (5.2 streaming + 5.3 multimodal) */}
        <SmartInputBar
          onSend={handleSend}
          onStop={stop}
          isStreaming={isCurrentlyStreaming}
        />
      </main>
    </div>
  );
}

```

---

<!-- SKIPPED (non-source): app/globals.css -->
## `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { PersonaConflictModal } from "@/components/settings/PersonaConflictModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Omni AI Chat",
  description: "Multimodal AI Chat Platform — GPT-4o, Claude, Groq, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <I18nProvider>
          <AuthProvider>
            {children}
            <PersonaConflictModal />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

```

---

## `app/page.tsx`

```tsx
import { redirect } from "next/navigation";

// Root redirect: authenticated users go to /chat, others to /auth/login
// The actual auth guard is in /chat/page.tsx (client-side, reads localStorage)
export default function RootPage() {
  redirect("/chat");
}

```

---

## `app/settings/page.tsx`

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  UserCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import {
  getApiKeys, addApiKey, updateApiKey, deleteApiKey, activateApiKey,
  revealApiKey, getMe, patchMe,
  getUserSettings, patchUserSettings, testProviderKey, fetchProviderModels,
  type ProviderKeyGroup, type StoredKeyInfo,
} from "@/lib/api";
import { PROVIDERS, PROVIDER_KEY_URLS } from "@/lib/types";
import type { ProviderConfig, PersonaConfig, UserSettings } from "@/lib/types";
import {
  loadGuestSettings,
  updateGuestApiKey,
  removeGuestApiKey,
  setPreferredProvider,
  setPreferredModel,
} from "@/lib/guestSettings";
import {
  loadLocalPersona,
  saveLocalPersona,
  EMPTY_PERSONA,
} from "@/lib/personaSync";

const TONE_OPTIONS = ["helpful", "formal", "casual", "concise", "creative"];

// ── Persona editor ────────────────────────────────────────────────────────────

function PersonaEditor({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [cfg, setCfg] = useState<PersonaConfig>(EMPTY_PERSONA);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      getMe()
        .then((u) => setCfg((u.persona_config as PersonaConfig) ?? EMPTY_PERSONA))
        .catch(() => {});
    } else {
      setCfg(loadLocalPersona() ?? EMPTY_PERSONA);
    }
  }, [isAuthenticated]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isAuthenticated) {
        await patchMe({ persona_config: cfg });
      } else {
        saveLocalPersona(cfg);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <UserCircleIcon className="w-5 h-5 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">Persona</h2>
        {!isAuthenticated && (
          <span className="text-xs text-gray-500">(stored locally)</span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">System persona</label>
          <textarea
            value={cfg.persona}
            onChange={(e) => setCfg((c) => ({ ...c, persona: e.target.value }))}
            placeholder="e.g. You are a senior Python engineer who gives concise code-focused answers."
            rows={3}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Preferred language</label>
            <input
              type="text"
              value={cfg.language}
              onChange={(e) => setCfg((c) => ({ ...c, language: e.target.value }))}
              placeholder="en, vi, fr…"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Tone</label>
            <select
              value={cfg.tone}
              onChange={(e) => setCfg((c) => ({ ...c, tone: e.target.value }))}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg transition-colors"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save persona"}
      </button>
    </div>
  );
}

// ── Single stored key row ─────────────────────────────────────────────────────

function StoredKeyRow({
  keyInfo,
  provider,
  onActivate,
  onDelete,
  onReveal,
}: {
  keyInfo: StoredKeyInfo;
  provider: string;
  onActivate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReveal: (id: string) => Promise<string>;
}) {
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleActivate = async () => {
    setActivating(true);
    try { await onActivate(keyInfo.id); } finally { setActivating(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(keyInfo.id); } finally { setDeleting(false); }
  };

  const handleCopy = async () => {
    try {
      const plain = await onReveal(keyInfo.id);
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
      keyInfo.is_active
        ? "border-blue-500/40 bg-blue-500/5"
        : "border-gray-700 bg-gray-900/50"
    }`}>
      {/* Active indicator */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${keyInfo.is_active ? "bg-blue-400" : "bg-gray-600"}`} />

      {/* Label + masked key */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{keyInfo.label}</span>
          {keyInfo.is_active && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex-shrink-0">
              <BoltIcon className="w-3 h-3" />
              Active
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-gray-500">{keyInfo.masked_key}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded"
          title="Copy key"
        >
          {copied
            ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
            : <ClipboardDocumentIcon className="w-4 h-4" />}
        </button>

        {!keyInfo.is_active && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400 rounded transition-colors disabled:opacity-40"
            title="Set as active"
          >
            {activating ? "…" : "Use"}
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded disabled:opacity-40"
          title="Delete key"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Add-key inline form ───────────────────────────────────────────────────────

type TestState = "idle" | "testing" | "ok" | "fail";

function AddKeyForm({
  provider,
  placeholder,
  onAdd,
  onCancel,
}: {
  provider: string;
  placeholder: string;
  onAdd: (apiKey: string, label: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTestState("testing");
    setTestMsg(null);
    try {
      const res = await testProviderKey(provider, apiKey.trim());
      setTestState(res.ok ? "ok" : "fail");
      setTestMsg(res.message);
    } catch (e: unknown) {
      setTestState("fail");
      setTestMsg(e instanceof Error ? e.message : "Test failed");
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(apiKey.trim(), label.trim() || "Default");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-gray-600 bg-gray-900 space-y-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder='Label (e.g. "Personal", "Work")'
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTestState("idle"); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={placeholder}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            tabIndex={-1}
          >
            {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>

        {apiKey.trim() && (
          <button
            onClick={handleTest}
            disabled={testState === "testing"}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
              testState === "ok"
                ? "border-green-600 text-green-400 bg-green-900/20"
                : testState === "fail"
                ? "border-red-600 text-red-400 bg-red-900/20"
                : "border-gray-600 text-gray-400 hover:border-gray-400"
            }`}
          >
            {testState === "testing" ? "Testing…" : testState === "ok" ? "✓" : testState === "fail" ? "✗" : "Test"}
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
      {testMsg && (
        <p className={`text-xs ${testState === "ok" ? "text-green-400" : "text-red-400"}`}>{testMsg}</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Authenticated: server-side provider card ──────────────────────────────────

function ServerApiKeyCard({
  group,
  onUpdated,
}: {
  group: ProviderKeyGroup;
  onUpdated: () => void;
}) {
  const provider = PROVIDERS.find((p) => p.id === group.provider);
  const placeholder = provider?.placeholder ?? "API key…";
  const keyPageUrl = PROVIDER_KEY_URLS[group.provider];

  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = async (apiKey: string, label: string) => {
    await addApiKey(group.provider, apiKey, label, true);
    setShowAddForm(false);
    onUpdated();
  };

  const handleActivate = async (keyId: string) => {
    await activateApiKey(group.provider, keyId);
    onUpdated();
  };

  const handleDelete = async (keyId: string) => {
    await deleteApiKey(group.provider, keyId);
    onUpdated();
  };

  const handleReveal = async (keyId: string): Promise<string> => {
    return revealApiKey(group.provider, keyId);
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{group.name}</span>
          {group.is_set ? (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              group.using_system_key
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                : "bg-green-500/15 text-green-400 border border-green-500/30"
            }`}>
              <CheckCircleIcon className="w-3 h-3" />
              {group.using_system_key ? "System key" : `${group.keys.length} key${group.keys.length !== 1 ? "s" : ""}`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600">
              <XCircleIcon className="w-3 h-3" />
              Not set
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick link to provider API key page */}
          {keyPageUrl && (
            <a
              href={keyPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-blue-300 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-colors"
              title={`Get ${group.name} API key`}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              Get key
            </a>
          )}

          {/* Add new key button */}
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Add key
            </button>
          )}
        </div>
      </div>

      {/* Stored keys list */}
      {group.keys.length > 0 && (
        <div className="space-y-2">
          {group.keys.map((k) => (
            <StoredKeyRow
              key={k.id}
              keyInfo={k}
              provider={group.provider}
              onActivate={handleActivate}
              onDelete={handleDelete}
              onReveal={handleReveal}
            />
          ))}
        </div>
      )}

      {/* Inline add form */}
      {showAddForm && (
        <AddKeyForm
          provider={group.provider}
          placeholder={placeholder}
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

// ── Authenticated: default provider/model section ─────────────────────────────

function AuthPreferenceSection() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [providerModels, setProviderModels] = useState<string[]>([]);

  useEffect(() => {
    getUserSettings()
      .then(async (s) => {
        setSettings(s);
        const models = await fetchProviderModels(s.default_provider).catch(() => []);
        setProviderModels(models);
      })
      .catch(() => {});
  }, []);

  const handleProviderChange = async (provider: string) => {
    if (!settings) return;
    setSettings((s) => s ? { ...s, default_provider: provider } : s);
    try {
      const models = await fetchProviderModels(provider);
      setProviderModels(models);
      const newModel = models[0] ?? "";
      setSettings((s) => s ? { ...s, default_model: newModel } : s);
    } catch { /* keep existing models */ }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await patchUserSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* not critical */ }
    finally { setSaving(false); }
  };

  if (!settings) {
    return <div className="h-28 rounded-xl bg-gray-800/50 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">Default provider &amp; model</h2>
      <p className="text-xs text-gray-400">
        Used when no explicit provider is selected. Stored server-side and synced across devices.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
          <select
            value={settings.default_provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Model</label>
          <select
            value={settings.default_model}
            onChange={(e) => setSettings((s) => s ? { ...s, default_model: e.target.value } : s)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {providerModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save defaults"}
      </button>
    </div>
  );
}

// ── Guest: localStorage key card ─────────────────────────────────────────────

function GuestApiKeyCard({
  provider,
  savedKey,
  onUpdated,
}: {
  provider: ProviderConfig;
  savedKey: string;
  onUpdated: () => void;
}) {
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedSaved, setCopiedSaved] = useState(false);
  const [copiedInput, setCopiedInput] = useState(false);
  const keyPageUrl = PROVIDER_KEY_URLS[provider.id];

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    updateGuestApiKey(provider.id, trimmed);
    setInputKey("");
    onUpdated();
  };

  const handleCopySaved = () => {
    navigator.clipboard.writeText(savedKey);
    setCopiedSaved(true);
    setTimeout(() => setCopiedSaved(false), 2000);
  };

  const handleCopyInput = () => {
    if (!inputKey.trim()) return;
    navigator.clipboard.writeText(inputKey.trim());
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 2000);
  };

  const maskedSaved = savedKey
    ? savedKey.slice(0, 4) + "••••••••" + savedKey.slice(-4)
    : null;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{provider.name}</span>
          {savedKey ? (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-400 border border-green-500/30">
              <CheckCircleIcon className="w-3 h-3" />
              Local key set
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600">
              <XCircleIcon className="w-3 h-3" />
              Not set
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {maskedSaved && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">{maskedSaved}</span>
              <button
                type="button"
                onClick={handleCopySaved}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Copy saved key"
              >
                {copiedSaved
                  ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
                  : <ClipboardDocumentIcon className="w-4 h-4" />}
              </button>
            </div>
          )}
          {keyPageUrl && (
            <a
              href={keyPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-blue-300 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-colors"
              title={`Get ${provider.name} API key`}
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              Get key
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={inputKey}
            onChange={(e) => { setInputKey(e.target.value); setCopiedInput(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={provider.placeholder}
            className={`w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${inputKey.trim() ? "pr-16" : "pr-9"}`}
          />
          {inputKey.trim() && (
            <button
              type="button"
              onClick={handleCopyInput}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              tabIndex={-1}
              title="Copy key"
            >
              {copiedInput
                ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
                : <ClipboardDocumentIcon className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            tabIndex={-1}
          >
            {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={!inputKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Save
        </button>
        {savedKey && (
          <button
            onClick={() => { removeGuestApiKey(provider.id); onUpdated(); }}
            className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-red-600/80 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Preferred provider / model (guest only) ───────────────────────────────────

function PreferenceSection({
  preferredProvider,
  preferredModelByProvider,
  onChange,
}: {
  preferredProvider: string;
  preferredModelByProvider: Record<string, string>;
  onChange: () => void;
}) {
  const currentProvider = PROVIDERS.find((p) => p.id === preferredProvider) ?? PROVIDERS[0];
  const currentModel = preferredModelByProvider[preferredProvider] ?? currentProvider.defaultModel;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">Default provider &amp; model</h2>
      <p className="text-xs text-gray-400">Used automatically when starting a new chat.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
          <select
            value={preferredProvider}
            onChange={(e) => { setPreferredProvider(e.target.value); onChange(); }}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Model</label>
          <select
            value={currentModel}
            onChange={(e) => { setPreferredModel(preferredProvider, e.target.value); onChange(); }}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {currentProvider.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();

  const [serverGroups, setServerGroups] = useState<ProviderKeyGroup[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const reloadServerKeys = useCallback(async () => {
    setLoadingServer(true);
    setServerError(null);
    try {
      setServerGroups(await getApiKeys());
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) reloadServerKeys();
  }, [isAuthenticated, reloadServerKeys]);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const guestSettings = loadGuestSettings();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to chat
        </Link>

        <div>
          <div className="flex items-center gap-3 mb-1">
            <KeyIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          {!isAuthenticated && (
            <p className="text-sm text-gray-400">
              Settings are stored locally in your browser.{" "}
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 underline">
                Log in
              </Link>{" "}
              to save them securely on the server and sync across devices.
            </p>
          )}
        </div>

        <PersonaEditor isAuthenticated={isAuthenticated} />

        {isAuthenticated ? (
          <AuthPreferenceSection />
        ) : (
          <PreferenceSection
            preferredProvider={guestSettings.preferredProvider}
            preferredModelByProvider={guestSettings.preferredModelByProvider}
            onChange={refresh}
          />
        )}

        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-4">API Keys</h2>
          {isAuthenticated ? (
            loadingServer ? (
              <div className="space-y-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-gray-800/50 animate-pulse" />
                ))}
              </div>
            ) : serverError ? (
              <p className="text-red-400 text-sm">{serverError}</p>
            ) : (
              <div className="space-y-4">
                {[...serverGroups]
                  .sort((a, b) => {
                    const ai = PROVIDERS.findIndex((p) => p.id === a.provider);
                    const bi = PROVIDERS.findIndex((p) => p.id === b.provider);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                  })
                  .map((g) => (
                    <ServerApiKeyCard key={g.provider} group={g} onUpdated={reloadServerKeys} />
                  ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {PROVIDERS.map((p) => (
                <GuestApiKeyCard
                  key={p.id}
                  provider={p}
                  savedKey={guestSettings.apiKeys[p.id] ?? ""}
                  onUpdated={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

```

---

## `components/agents/AgentCard.tsx`

```tsx
"use client";

import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import type { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onDuplicate: (agent: Agent) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onDuplicate }: Props) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{agent.name}</h3>
            {agent.is_public ? (
              <GlobeAltIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" title="Public" />
            ) : (
              <LockClosedIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" title="Private" />
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{agent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDuplicate(agent)}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            title="Duplicate"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(agent)}
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(agent)}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {agent.system_prompt && (
        <p className="text-xs text-gray-500 font-mono bg-gray-900/50 rounded-lg px-3 py-2 line-clamp-2 border border-gray-700/50">
          {agent.system_prompt}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        {agent.model && (
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
            {agent.model}
          </span>
        )}
        {agent.tools.map((t) => (
          <span key={t} className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-full">
            {t}
          </span>
        ))}
        {!agent.model && agent.tools.length === 0 && (
          <span className="text-xs text-gray-600">No overrides</span>
        )}
      </div>
    </div>
  );
}

```

---

## `components/agents/AgentForm.tsx`

```tsx
"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { Agent, AgentCreateRequest, AgentUpdateRequest } from "@/lib/types";
import { PROVIDERS } from "@/lib/types";

interface Props {
  initial?: Agent;
  onSubmit: (data: AgentCreateRequest | AgentUpdateRequest) => Promise<void>;
  onCancel: () => void;
}

const ALL_TOOLS = [
  { id: "web_search", label: "Web Search" },
];

export function AgentForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        model: model.trim() || undefined,
        tools,
        is_public: isPublic,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Flat list of all available models from all providers
  const allModels = PROVIDERS.flatMap((p) => p.models.map((m) => ({ label: `${p.name} — ${m}`, value: m })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            {initial ? "Edit agent" : "New agent"}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Python Expert"
              required
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a senior Python engineer who gives concise, idiomatic answers and always includes type hints."
              rows={5}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Model override <span className="text-gray-600">(optional)</span></label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Use intent routing (default)</option>
              {allModels.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">Tools</label>
            <div className="flex flex-wrap gap-2">
              {ALL_TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTool(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    tools.includes(t.id)
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is-public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is-public" className="text-sm text-gray-300">
              Public — visible to other users
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {saving ? "Saving…" : initial ? "Save changes" : "Create agent"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

```

---

## `components/agents/AgentSelector.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CpuChipIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Agent } from "@/lib/types";

interface Props {
  agents: Agent[];
  activeAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}

export function AgentSelector({ agents, activeAgentId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (agents.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeAgent
            ? "bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
            : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
        }`}
      >
        <CpuChipIcon className="w-3.5 h-3.5" />
        <span className="max-w-[120px] truncate">
          {activeAgent ? activeAgent.name : "Select agent"}
        </span>
        {activeAgent ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSelect(null); }}}
            className="ml-0.5 hover:text-white"
            aria-label="Clear agent"
          >
            <XMarkIcon className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Agents</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {activeAgent && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-800 transition-colors text-gray-400 text-sm"
              >
                <XMarkIcon className="w-4 h-4 shrink-0" />
                <span>No agent</span>
              </button>
            )}
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { onSelect(agent.id); setOpen(false); }}
                className={`w-full flex flex-col px-3 py-2.5 text-left hover:bg-gray-800 transition-colors ${
                  agent.id === activeAgentId ? "bg-blue-900/20" : ""
                }`}
              >
                <span className={`text-sm font-medium ${agent.id === activeAgentId ? "text-blue-400" : "text-white"}`}>
                  {agent.name}
                </span>
                {agent.description && (
                  <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">{agent.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

```

---

## `components/chat/ActionButtons.tsx`

```tsx
"use client";

// US02 AC3: Copy, Like/Dislike, Re-generate buttons shown after streaming completes.

import { useState } from "react";
import {
  ClipboardIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/20/solid";

interface ActionButtonsProps {
  content: string;
  onRegenerate?: () => void;
}

export function ActionButtons({ content, onRegenerate }: ActionButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
        title="Copy"
      >
        {copied ? (
          <CheckIcon className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <ClipboardIcon className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        onClick={() => setVote(vote === "up" ? null : "up")}
        className={`p-1 rounded hover:bg-gray-700 transition-colors ${
          vote === "up" ? "text-green-400" : "text-gray-500 hover:text-gray-300"
        }`}
        title="Like"
      >
        <HandThumbUpIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setVote(vote === "down" ? null : "down")}
        className={`p-1 rounded hover:bg-gray-700 transition-colors ${
          vote === "down" ? "text-red-400" : "text-gray-500 hover:text-gray-300"
        }`}
        title="Dislike"
      >
        <HandThumbDownIcon className="w-3.5 h-3.5" />
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          title="Re-generate"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

```

---

## `components/chat/CitationPanel.tsx`

```tsx
"use client";

// US03 AC2: Side panel that opens when user clicks a [n] citation number.
// Does not interrupt the chat flow.

import { XMarkIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { Citation } from "@/lib/types";

interface CitationPanelProps {
  citation: Citation;
  onClose: () => void;
}

export function CitationPanel({ citation, onClose }: CitationPanelProps) {
  return (
    <aside className="w-80 shrink-0 h-full bg-gray-800 border-l border-gray-700 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-200">Source [{citation.id}]</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-sm font-medium text-gray-200 leading-snug">
          {citation.title ?? citation.url}
        </p>
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Open source <ArrowTopRightOnSquareIcon className="w-3 h-3" />
        </a>
        <iframe
          src={citation.url}
          title={`Source ${citation.id}`}
          className="w-full h-64 rounded-lg border border-gray-700 bg-gray-900"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </aside>
  );
}

```

---

## `components/chat/MarkdownRenderer.tsx`

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { CSSProperties } from "react";
import type { Citation } from "@/lib/types";

interface MarkdownRendererProps {
  content: string;
  citations?: Citation[];
  onCitationClick?: (c: Citation) => void;
}

// Replace [N] citation markers with a placeholder the markdown parser won't mangle
function injectCitationPlaceholders(text: string): string {
  return text.replace(/\[(\d+)\]/g, "‹$1›");
}

// Split plain text nodes on citation placeholders and render interactive buttons
function renderTextWithCitations(
  text: string,
  citations: Citation[],
  onCitationClick: (c: Citation) => void
): React.ReactNode {
  const parts = text.split(/(‹\d+›)/g);
  return parts.map((part, i) => {
    const match = part.match(/^‹(\d+)›$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const citation = citations.find((c) => c.id === num);
      if (citation) {
        return (
          <button
            key={i}
            onClick={() => onCitationClick(citation)}
            className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-accent text-white font-bold hover:bg-accent-hover transition-colors mx-0.5 align-middle"
          >
            {num}
          </button>
        );
      }
    }
    return part;
  });
}

export function MarkdownRenderer({
  content,
  citations = [],
  onCitationClick,
}: MarkdownRendererProps) {
  const hasCitations = citations.length > 0 && onCitationClick;
  const processedContent = hasCitations
    ? injectCitationPlaceholders(content)
    : content;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with syntax highlighting
        code({ node: _node, className, children }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const isBlock = !!match || String(children).includes("\n");

          if (isBlock) {
            const lang = match?.[1] ?? "text";
            return (
              <div className="my-3 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-gray-800 px-4 py-1.5 text-xs text-gray-400 font-mono">
                  <span>{lang}</span>
                </div>
                <SyntaxHighlighter
                  style={oneDark as { [key: string]: CSSProperties }}
                  language={lang}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.8125rem",
                    lineHeight: "1.6",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className="bg-gray-700/70 text-pink-300 px-1.5 py-0.5 rounded text-[0.8125em] font-mono">
              {children}
            </code>
          );
        },

        // Paragraphs — inject citations into text nodes
        p({ children }) {
          if (!hasCitations) return <p className="mb-3 last:mb-0">{children}</p>;
          const processed = processChildren(children, citations, onCitationClick!);
          return <p className="mb-3 last:mb-0">{processed}</p>;
        },

        // Headings
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-100">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-gray-100">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-gray-200">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-gray-200">{children}</h4>,

        // Lists
        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-gray-100">{children}</li>,

        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-accent/60 pl-4 py-1 my-3 text-gray-400 italic bg-gray-800/40 rounded-r">
            {children}
          </blockquote>
        ),

        // Tables (GFM)
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border border-gray-600 rounded-lg text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-gray-700">{children}</tbody>,
        tr: ({ children }) => <tr className="even:bg-gray-800/30">{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-gray-300 border-b border-gray-600">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="px-3 py-2 text-gray-200">{children}</td>,

        // Horizontal rule
        hr: () => <hr className="border-gray-600 my-4" />,

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline hover:text-indigo-300 transition-colors"
          >
            {children}
          </a>
        ),

        // Strong / em
        strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

// Walk React children and inject citation buttons into text strings
function processChildren(
  children: React.ReactNode,
  citations: Citation[],
  onCitationClick: (c: Citation) => void
): React.ReactNode {
  if (typeof children === "string") {
    return renderTextWithCitations(children, citations, onCitationClick);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        const parts = renderTextWithCitations(child, citations, onCitationClick);
        return Array.isArray(parts) ? parts.map((p, j) => <span key={`${i}-${j}`}>{p}</span>) : parts;
      }
      return child;
    });
  }
  return children;
}

```

---

## `components/chat/MessageBubble.tsx`

```tsx
"use client";

import { useState } from "react";
import type { Citation, Message } from "@/lib/types";
import { ActionButtons } from "./ActionButtons";
import { CitationPanel } from "./CitationPanel";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: () => void;
}

export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const isUser = message.role === "user";
  const citations = message.citations ?? [];

  return (
    <>
      <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
        <div className={`max-w-[78%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>

          {/* Status indicator (while streaming) */}
          {message.statusText && !message.content && (
            <p className="text-xs text-gray-500 italic px-1">{message.statusText}</p>
          )}

          {/* Bubble */}
          {(message.content || message.isStreaming) && (
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                isUser
                  ? "bg-accent text-white rounded-br-sm whitespace-pre-wrap"
                  : "bg-gray-700 text-gray-100 rounded-bl-sm"
              }`}
            >
              {isUser ? (
                <span>{message.content}</span>
              ) : (
                <div className="prose-chat">
                  <MarkdownRenderer
                    content={message.content}
                    citations={citations}
                    onCitationClick={setOpenCitation}
                  />
                  {message.isStreaming && <span className="streaming-cursor" />}
                </div>
              )}
            </div>
          )}

          {/* Action buttons — shown on hover after streaming completes (US02 AC3) */}
          {!isUser && !message.isStreaming && message.content && (
            <ActionButtons content={message.content} onRegenerate={onRegenerate} />
          )}

          {/* Provider badge */}
          {!isUser && message.metadata?.model && !message.isStreaming && (
            <span className="text-xs text-gray-600 px-1">
              via {message.metadata.model}
            </span>
          )}
        </div>
      </div>

      {/* Citation side panel (US03 AC2) */}
      {openCitation && (
        <div className="fixed inset-y-0 right-0 z-50 flex">
          <CitationPanel citation={openCitation} onClose={() => setOpenCitation(null)} />
        </div>
      )}
    </>
  );
}

```

---

## `components/chat/MessageList.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  onRegenerate?: (messageId: string) => void;
}

export function MessageList({ messages, onRegenerate }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new content streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
        <div className="text-5xl">✨</div>
        <h2 className="text-xl font-semibold text-gray-200">How can I help you today?</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Ask me anything. I can search the web, analyze files, write code, and remember our past conversations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onRegenerate={onRegenerate ? () => onRegenerate(msg.id) : undefined}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

```

---

## `components/chat/ModelBadge.tsx`

```tsx
interface ModelBadgeProps {
  model?: string;
  provider?: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  groq: "⚡",
  openai: "🧠",
  anthropic: "🔮",
  google: "✨",
};

export function ModelBadge({ model, provider }: ModelBadgeProps) {
  if (!model) return null;
  const icon = provider ? (PROVIDER_ICONS[provider] ?? "🤖") : "🤖";
  const label = model
    .replace("gpt-4o", "GPT-4o")
    .replace("claude-3-5-sonnet-20241022", "Claude 3.5")
    .replace("llama-3.3-70b-versatile", "Llama 3.3 70B")
    .replace("llama-3.3-70b-specdec", "Llama 3.3 70B (Spec)")
    .replace("llama-3.1-8b-instant", "Llama 3.1 8B")
    .replace("gemma2-9b-it", "Gemma2 9B");

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-700 text-xs text-gray-300 font-medium">
      {icon} {label}
    </span>
  );
}

```

---

## `components/chat/ProviderModelSelector.tsx`

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { listProviders, fetchProviderModels } from '@/lib/api';
import type { ProviderCatalogItem } from '@/lib/types';
import { useI18n } from '@/contexts/I18nContext';

interface ProviderModelSelectorProps {
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderCatalogItem[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        const data = await listProviders();
        setProviders(data);
        // Set default provider if none selected
        if (!selectedProvider && data.length > 0) {
          onProviderChange(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProviders();
  }, [selectedProvider, onProviderChange]);

  // Load models when provider changes
  useEffect(() => {
    const loadModels = async () => {
      if (!selectedProvider) return;
      try {
        setLoading(true);
        const data = await fetchProviderModels(selectedProvider);
        setModels(data);
        // Set default model if none selected
        if (!selectedModel && data.length > 0) {
          onModelChange(data[0]);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoading(false);
      }
    };
    loadModels();
  }, [selectedProvider, selectedModel, onModelChange]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    onProviderChange(newProvider);
    // Reset model when provider changes
    const provider = providers.find((p) => p.id === newProvider);
    if (provider?.default_model) {
      onModelChange(provider.default_model);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg ">
      {/* Provider Selector */}
      <div className="flex flex-col gap-1">
        {/* <label htmlFor="provider-select" className="text-xs font-medium text-gray-400">
          {t('chat.provider', 'Provider')}
        </label> */}
        <select
          id="provider-select"
          value={selectedProvider}
          onChange={handleProviderChange}
          disabled={disabled || loading || providers.length === 0}
          className="px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? t('common.loading', 'Loading...') : t('chat.selectProvider', 'Select Provider')}
          </option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {t(`providers.${provider.id}`, provider.name)}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selector */}
      <div className="flex flex-col gap-1">
        {/* <label htmlFor="model-select" className="text-xs font-medium text-gray-400">
          {t('chat.model', 'Model')}
        </label> */}
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled || loading || models.length === 0 || !selectedProvider}
          className="px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? t('common.loading', 'Loading...') : t('chat.selectModel', 'Select Model')}
          </option>
          {models.map((model) => (
            <option key={model} value={model}>
              {t(`models.${model}`, model)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

```

---

## `components/common/LanguageSwitcher.tsx`

```tsx
'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('settings.language', 'Language')}:
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as 'en' | 'vi')}
        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="vi">Tiếng Việt (Vietnamese)</option>
        <option value="en">English</option>
      </select>
    </div>
  );
};

```

---

## `components/input/AttachmentButton.tsx`

```tsx
"use client";

// US01 AC2: Upload up to 5 files (JPG, PNG, PDF, DOCX, XLSX) up to 20MB each.
// US01 AC4: Shows "Uploading…" state for files > 5MB.

import { useRef, useState } from "react";
import { PaperClipIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Attachment } from "@/lib/types";

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 20 * 1024 * 1024;  // 20MB (AiChat-UIUX-Wireframe §IV R01)
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;
const ACCEPTED = ".jpg,.jpeg,.png,.pdf,.docx,.xlsx";

interface AttachmentButtonProps {
  attachments: Attachment[];
  onChange: (files: Attachment[]) => void;
  disabled?: boolean;
}

export function AttachmentButton({ attachments, onChange, disabled }: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).slice(0, MAX_FILES - attachments.length);
    const valid: Attachment[] = [];

    for (const file of incoming) {
      if (file.size > MAX_SIZE_BYTES) {
        alert(`"${file.name}" exceeds 20MB limit.`);
        continue;
      }
      valid.push({
        file,
        uploading: file.size > LARGE_FILE_THRESHOLD,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      });
    }

    onChange([...attachments, ...valid]);
  };

  const remove = (index: number) => {
    const next = attachments.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || attachments.length >= MAX_FILES}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
        title="Attach files"
      >
        <PaperClipIcon className="w-5 h-5" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Attachment preview chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map((att, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-lg text-xs text-gray-300 max-w-[140px]"
            >
              {att.preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.preview} alt="" className="w-4 h-4 rounded object-cover" />
              )}
              <span className="truncate">
                {att.uploading ? `Uploading…` : att.file.name}
              </span>
              <button onClick={() => remove(i)} className="text-gray-500 hover:text-red-400">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

```

---

## `components/input/SmartInputBar.tsx`

```tsx
"use client";

// AiChat-UIUX-Wireframe §I Smart Input Bar
// Features: auto-resize textarea, attachment picker, voice, model selector, send/stop

import { useCallback, useRef, useState } from "react";
import { PaperAirplaneIcon, StopIcon } from "@heroicons/react/24/solid";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import type { Attachment } from "@/lib/types";
import { AttachmentButton } from "./AttachmentButton";
import { VoiceButton } from "./VoiceButton";

const MAX_CHARS = 4000; // US01 AC1

type ModelPref = "auto" | "speed" | "quality";

interface SmartInputBarProps {
  onSend: (content: string, model: ModelPref, tools: string[], attachments: string[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function SmartInputBar({ onSend, onStop, isStreaming, disabled }: SmartInputBarProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modelPref, setModelPref] = useState<ModelPref>("auto");
  const [webSearch, setWebSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const content = value.trim();
    if (!content || isStreaming) return;
    const tools = webSearch ? ["web_search"] : [];
    // Pass file names as attachment references (full upload handled in Phase 5.3 extension)
    const attachmentRefs = attachments.map((a) => a.file.name);
    onSend(content, modelPref, tools, attachmentRefs);
    setValue("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [value, isStreaming, webSearch, attachments, modelPref, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charsLeft = MAX_CHARS - value.length;

  return (
    <div className="border-t border-gray-700 bg-chat-bg px-4 py-3">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mb-2">
          <AttachmentButton
            attachments={attachments}
            onChange={setAttachments}
            disabled={isStreaming}
          />
        </div>
      )}

      <div className="flex items-end gap-2 bg-input-bg rounded-2xl px-3 py-2 border border-gray-600 focus-within:border-accent transition-colors">
        {/* Attachment icon (no preview chips here — shown above) */}
        <div className="self-end pb-0.5">
          <AttachmentButton
            attachments={[]}
            onChange={(f) => setAttachments((p) => [...p, ...f])}
            disabled={isStreaming || attachments.length >= 5}
          />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value.slice(0, MAX_CHARS)); autoResize(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Message Omni AI…"
          disabled={disabled || isStreaming}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-500 leading-relaxed py-1 max-h-[200px] overflow-y-auto"
        />

        {/* Right controls */}
        <div className="flex items-center gap-1 self-end pb-0.5 shrink-0">
          {/* Web search toggle (FR-03) */}
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            title="Toggle web search"
            className={`p-1.5 rounded-lg transition-colors ${
              webSearch ? "text-accent bg-indigo-900/40" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <GlobeAltIcon className="w-4 h-4" />
          </button>

          {/* Model preference selector */}
          <select
            value={modelPref}
            onChange={(e) => setModelPref(e.target.value as ModelPref)}
            className="text-xs bg-transparent text-gray-500 border-none outline-none cursor-pointer hover:text-gray-300"
          >
            <option value="auto">Auto</option>
            <option value="speed">⚡ Speed</option>
            <option value="quality">🧠 Quality</option>
          </select>

          {/* Voice button (US01 AC3) */}
          <VoiceButton
            onTranscript={(t) => setValue((v) => (v + " " + t).trim())}
            disabled={isStreaming}
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Stop generating (US02 AC2)"
            >
              <StopIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send (Enter)"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Char counter */}
      {value.length > MAX_CHARS * 0.8 && (
        <p className={`text-xs mt-1 text-right ${charsLeft < 100 ? "text-red-400" : "text-gray-500"}`}>
          {charsLeft} characters left
        </p>
      )}
    </div>
  );
}

```

---

## `components/input/VoiceButton.tsx`

```tsx
"use client";

// US01 AC3: Hold microphone button → voice-to-text via Web Speech API
// Shows audio-wave animation while recording.

import { useCallback, useEffect, useRef, useState } from "react";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/solid";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscript, disabled }: VoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "vi-VN,en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return (
    <button
      type="button"
      onMouseDown={startRecording}
      onMouseUp={stopRecording}
      onTouchStart={startRecording}
      onTouchEnd={stopRecording}
      disabled={disabled}
      className={`p-2 rounded-lg transition-all ${
        recording
          ? "bg-red-600 text-white animate-pulse scale-110"
          : "text-gray-400 hover:text-white hover:bg-gray-700"
      } disabled:opacity-40`}
      title={recording ? "Release to stop" : "Hold to speak"}
    >
      {recording ? (
        <StopIcon className="w-5 h-5" />
      ) : (
        <MicrophoneIcon className="w-5 h-5" />
      )}
    </button>
  );
}

```

---

## `components/settings/ApiKeyCard.tsx`

```tsx
"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { ApiKeyStatus } from "@/lib/api";
import { saveApiKey, deleteApiKey } from "@/lib/api";

const PROVIDER_LABELS: Record<string, { name: string; placeholder: string }> = {
  openai:    { name: "OpenAI",    placeholder: "sk-..." },
  anthropic: { name: "Anthropic", placeholder: "sk-ant-..." },
  groq:      { name: "Groq",      placeholder: "gsk_..." },
  google:    { name: "Google",    placeholder: "AIza..." },
};

interface Props {
  status: ApiKeyStatus;
  onUpdated: () => void;
}

export function ApiKeyCard({ status, onUpdated }: Props) {
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = PROVIDER_LABELS[status.provider] ?? { name: status.provider, placeholder: "API key…" };

  const handleSave = async () => {
    if (!inputKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveApiKey(status.provider, inputKey.trim());
      setInputKey("");
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await deleteApiKey(status.provider);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{label.name}</span>
          {status.is_set ? (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              status.using_system_key
                ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                : "bg-green-500/15 text-green-400 border border-green-500/30"
            }`}>
              <CheckCircleIcon className="w-3 h-3" />
              {status.using_system_key ? "System key" : "Connected"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400 border border-gray-600">
              <XCircleIcon className="w-3 h-3" />
              Not set
            </span>
          )}
        </div>
        {status.is_set && !status.using_system_key && (
          <span className="text-xs font-mono text-gray-400">{status.masked_key}</span>
        )}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={label.placeholder}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-9"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            tabIndex={-1}
          >
            {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !inputKey.trim()}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status.is_set && !status.using_system_key && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-red-600/80 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

```

---

## `components/settings/PersonaConflictModal.tsx`

```tsx
"use client";

export function PersonaConflictModal() {
  return null;
}

```

---

## `components/sidebar/QuotaMeter.tsx`

```tsx
"use client";

// Reads daily quota from localStorage key set by the done SSE event.
// Shows a simple progress bar (Schema Group D / Business Rule #1).

import { useEffect, useState } from "react";

const DAILY_LIMIT = 50_000;
const STORAGE_KEY = "omni_daily_tokens";

export function QuotaMeter() {
  const [used, setUsed] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setUsed(parseInt(stored, 10));

    const handler = () => {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) setUsed(parseInt(v, 10));
    };
    window.addEventListener("omni:quota_updated", handler);
    return () => window.removeEventListener("omni:quota_updated", handler);
  }, []);

  const pct = Math.min(100, Math.round((used / DAILY_LIMIT) * 100));
  const remaining = Math.max(0, DAILY_LIMIT - used).toLocaleString();

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Daily quota</span>
        <span>{remaining} tokens left</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

```

---

## `components/sidebar/Sidebar.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon, TrashIcon, ChatBubbleLeftIcon, Cog6ToothIcon, UserCircleIcon, CpuChipIcon } from "@heroicons/react/24/outline";
import type { Conversation } from "@/lib/types";
import { createConversation, deleteConversation, fetchConversations } from "@/lib/api";
import { QuotaMeter } from "./QuotaMeter";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  activeConvId?: string;
  onSelectConv: (id: string) => void;
  onNewConv: (id: string) => void;
}

export function Sidebar({ activeConvId, onSelectConv, onNewConv }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConversations()
      .then(setConversations)
      .catch(() => {});
  }, [activeConvId, isAuthenticated]);

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
              <button
                key={conv.id}
                onClick={() => onSelectConv(conv.id)}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  conv.id === activeConvId
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <ChatBubbleLeftIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate">
                  {conv.title || "New conversation"}
                </span>
                <span
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-opacity cursor-pointer"
                >
                  <TrashIcon className="w-3 h-3" />
                </span>
              </button>
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

```

---

## `contexts/AuthContext.tsx`

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, getToken } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = getToken();
    if (stored) {
      setToken(stored);
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const accessToken = await apiLogin(email, password);
    // apiLogin already persists to localStorage via setToken
    setToken(accessToken);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("omni_token");
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

```

---

## `contexts/I18nContext.tsx`

```tsx
"use client";

import { createContext, useContext } from "react";

interface I18nContextType {
  locale: string;
  t: (key: string, defaultValue?: string) => string;
}

const defaultT = (_key: string, defaultValue = "") => defaultValue;

const I18nContext = createContext<I18nContextType>({ locale: "en", t: defaultT });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale: "en", t: defaultT }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

```

---

## `hooks/useChat.ts`

```ts
"use client";

import { useCallback, useReducer, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Citation, Message } from "@/lib/types";
import { useSSE } from "./useSSE";
import type { ChatRequest } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { loadGuestSettings, resolveModel } from "@/lib/guestSettings";

type Action =
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "START_STREAMING"; assistantId: string }
  | { type: "APPEND_DELTA"; assistantId: string; delta: string }
  | { type: "SET_STATUS"; assistantId: string; status: string }
  | { type: "SET_CITATIONS"; assistantId: string; citations: Citation[] }
  | { type: "FINISH_STREAMING"; assistantId: string; provider: string; model: string }
  | { type: "SET_DISCONNECTED"; assistantId: string }
  | { type: "CLEAR_MESSAGES" };

function reducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "ADD_MESSAGE":
      return [...state, action.message];
    case "START_STREAMING":
      return [...state, {
        id: action.assistantId, role: "assistant", content: "",
        isStreaming: true, statusText: "Thinking…",
      }];
    case "APPEND_DELTA":
      return state.map((m) =>
        m.id === action.assistantId
          ? { ...m, content: m.content + action.delta, statusText: undefined }
          : m
      );
    case "SET_STATUS":
      return state.map((m) =>
        m.id === action.assistantId ? { ...m, statusText: action.status } : m
      );
    case "SET_CITATIONS":
      return state.map((m) =>
        m.id === action.assistantId ? { ...m, citations: action.citations } : m
      );
    case "FINISH_STREAMING":
      return state.map((m) =>
        m.id === action.assistantId
          ? { ...m, isStreaming: false, statusText: undefined,
              metadata: { provider: action.provider, model: action.model } }
          : m
      );
    case "SET_DISCONNECTED":
      return state.map((m) =>
        m.id === action.assistantId
          ? { ...m, isStreaming: false, statusText: "⚠ Connection lost — partial response saved." }
          : m
      );
    case "CLEAR_MESSAGES":
      return [];
    default:
      return state;
  }
}

export function useChat(
  conversationId: string | undefined,
  activeAgentId?: string | null,
) {
  const [messages, dispatch] = useReducer(reducer, []);
  const { stream, stop, getPartialRecovery } = useSSE();
  const isStreamingRef = useRef(false);
  const { isAuthenticated } = useAuth();

  const sendMessage = useCallback(async (
    content: string,
    modelPreference: "auto" | "speed" | "quality" = "auto",
    tools: string[] = [],
    attachments: string[] = [],
    provider?: string,
    model?: string,
  ) => {
    if (isStreamingRef.current) return;
    isStreamingRef.current = true;

    const userMsgId = uuidv4();
    dispatch({ type: "ADD_MESSAGE", message: { id: userMsgId, role: "user", content } });

    const assistantId = uuidv4();
    dispatch({ type: "START_STREAMING", assistantId });

    // Build base request body
    const body: ChatRequest = {
      conversation_id: conversationId,
      model_preference: modelPreference,
      messages: [{ role: "user", content, attachments }],
      tools,
      stream: true,
      agent_id: activeAgentId ?? undefined,
    };

    // Guest mode: inject provider + model + api_key from localStorage settings.
    // Authenticated users rely on the backend BYOK + intent routing.
    if (!isAuthenticated) {
      const gs = loadGuestSettings();
      const provider = gs.preferredProvider;
      const model = resolveModel(gs, provider);
      const apiKey = gs.apiKeys[provider] ?? "";

      body.provider = provider || undefined;
      body.model = model || undefined;
      // Only include api_key when we actually have one (avoid sending empty string)
      if (apiKey) body.api_key = apiKey;
    } else if (provider || model) {
      // Authenticated users can also explicitly select provider/model
      body.provider = provider;
      body.model = model;
    }

    await stream(body, {
      onStatus: (text) => dispatch({ type: "SET_STATUS", assistantId, status: text }),
      onCitations: (citations) => dispatch({ type: "SET_CITATIONS", assistantId, citations }),
      onDelta: (delta) => dispatch({ type: "APPEND_DELTA", assistantId, delta }),
      onDone: (_usage, provider, model) =>
        dispatch({ type: "FINISH_STREAMING", assistantId, provider, model }),
      onError: (msg) =>
        dispatch({ type: "FINISH_STREAMING", assistantId, provider: "", model: msg }),
      onDisconnect: () => dispatch({ type: "SET_DISCONNECTED", assistantId }),
    });

    isStreamingRef.current = false;
  }, [conversationId, stream, isAuthenticated]);

  const clearMessages = useCallback(() => dispatch({ type: "CLEAR_MESSAGES" }), []);
  const isStreaming = () => isStreamingRef.current;
  const partialRecovery = getPartialRecovery;

  return { messages, sendMessage, stop, clearMessages, isStreaming, partialRecovery };
}

```

---

## `hooks/useSSE.ts`

```ts
"use client";

import { useCallback, useRef } from "react";
import type { Citation, SSEEvent } from "@/lib/types";
import { buildChatStream } from "@/lib/api";
import type { ChatRequest } from "@/lib/types";

const PARTIAL_KEY = "omni_partial_response";

interface SSECallbacks {
  onStatus: (text: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDelta: (delta: string) => void;
  onDone: (usage: SSEEvent["usage"], provider: string, model: string) => void;
  onError: (msg: string) => void;
  onDisconnect: () => void;
}

export function useSSE() {
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (body: ChatRequest, callbacks: SSECallbacks) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const { url, init } = buildChatStream(body);
    let partialContent = "";

    const savePartial = () => {
      if (partialContent) localStorage.setItem(PARTIAL_KEY, partialContent);
    };

    try {
      const response = await fetch(url, { ...init, signal: abortRef.current.signal });
      if (!response.ok) {
        // Read structured error from body when available
        const body = await response.json().catch(() => ({}));
        const msg: string = body.message ?? body.detail ?? `Server error ${response.status}`;
        callbacks.onError(msg);
        return;
      }
      if (!response.body) {
        callbacks.onError("No response body");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SSEEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              callbacks.onStatus(event.content ?? "");
              break;
            case "citations":
              callbacks.onCitations(event.links ?? []);
              break;
            case "content":
              partialContent += event.delta ?? "";
              savePartial();
              callbacks.onDelta(event.delta ?? "");
              break;
            case "done":
              localStorage.removeItem(PARTIAL_KEY);
              callbacks.onDone(
                event.usage,
                event.usage?.provider ?? "",
                event.usage?.model ?? ""
              );
              break;
            case "error":
              callbacks.onError(event.message ?? "Unknown error");
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // EX-04: save partial to LocalStorage on disconnect
      savePartial();
      callbacks.onDisconnect();
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // EX-04: recover partial response saved before disconnect
  const getPartialRecovery = useCallback((): string | null => {
    return localStorage.getItem(PARTIAL_KEY);
  }, []);

  return { stream, stop, getPartialRecovery };
}

```

---

## `i18n.config.ts`

```ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));

```

---

## `lib/agentStore.ts`

```ts
/**
 * Guest agent store — persists agents in localStorage for unauthenticated users.
 *
 * Key: aichat.agents.guest
 * On login, AuthContext offers to import these agents to the server.
 */

import type { Agent } from "./types";

const GUEST_AGENTS_KEY = "aichat.agents.guest";

let _idCounter = Date.now();
const tempId = () => `guest_${(_idCounter++).toString(36)}`;

export function loadGuestAgents(): Agent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_AGENTS_KEY);
    return raw ? (JSON.parse(raw) as Agent[]) : [];
  } catch {
    return [];
  }
}

function persist(agents: Agent[]): void {
  localStorage.setItem(GUEST_AGENTS_KEY, JSON.stringify(agents));
}

export function createGuestAgent(data: Omit<Agent, "id" | "created_at" | "updated_at" | "owner_user_id">): Agent {
  const now = new Date().toISOString();
  const agent: Agent = {
    ...data,
    id: tempId(),
    is_public: false,
    created_at: now,
    updated_at: now,
  };
  const all = loadGuestAgents();
  persist([agent, ...all]);
  return agent;
}

export function updateGuestAgent(id: string, data: Partial<Agent>): Agent | null {
  const all = loadGuestAgents();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...data, updated_at: new Date().toISOString() };
  all[idx] = updated;
  persist(all);
  return updated;
}

export function deleteGuestAgent(id: string): void {
  persist(loadGuestAgents().filter((a) => a.id !== id));
}

export function duplicateGuestAgent(id: string): Agent | null {
  const src = loadGuestAgents().find((a) => a.id === id);
  if (!src) return null;
  return createGuestAgent({ ...src, name: `${src.name} (copy)` });
}

export function clearGuestAgents(): void {
  localStorage.removeItem(GUEST_AGENTS_KEY);
}

```

---

## `lib/api.ts`

```ts
import type {
  Conversation, ChatRequest, User, PersonaConfig,
  Agent, AgentCreateRequest, AgentUpdateRequest,
  UserSettings, ProviderCatalogItem, TestKeyResult,
  StoredKeyInfo, ProviderKeyGroup,
} from "./types";

// Always use the relative /api prefix — works in both browser and server contexts.
// Next.js rewrites /api/* → backend internally (see next.config.ts).
const API_BASE = "/api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("omni_token");
}

export function setToken(token: string): void {
  localStorage.setItem("omni_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("omni_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message: string = body.message ?? body.detail ?? `HTTP ${res.status}`;
    const code: string = body.code ?? `HTTP_${res.status}`;
    throw Object.assign(new Error(message), {
      code,
      details: body.details ?? null,
      status: res.status,
    });
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<string> {
  const data = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data.access_token;
}

export async function register(
  email: string,
  full_name: string,
  password: string
): Promise<string> {
  const data = await request<{ access_token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, full_name, password }),
  });
  setToken(data.access_token);
  return data.access_token;
}

export async function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

export async function patchMe(body: { full_name?: string; persona_config?: PersonaConfig }): Promise<User> {
  return request<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function fetchConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/conversations");
}

export async function createConversation(): Promise<Conversation> {
  return request<Conversation>("/conversations", { method: "POST" });
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/conversations/${id}`, { method: "DELETE" });
}

export async function assignAgentToConversation(convId: string, agentId: string | null): Promise<void> {
  await request(`/conversations/${convId}/agent`, {
    method: "PUT",
    body: JSON.stringify({ agent_id: agentId }),
  });
}

// ── Settings / API Keys ───────────────────────────────────────────────────────

export type { StoredKeyInfo, ProviderKeyGroup };

export async function getApiKeys(): Promise<ProviderKeyGroup[]> {
  return request<ProviderKeyGroup[]>("/settings/api-keys");
}

export async function addApiKey(
  provider: string,
  apiKey: string,
  label: string = "Default",
  setActive: boolean = true,
): Promise<StoredKeyInfo> {
  return request<StoredKeyInfo>(`/settings/api-keys/${provider}`, {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey, label, set_active: setActive }),
  });
}

export async function updateApiKey(
  provider: string,
  keyId: string,
  body: { api_key?: string; label?: string },
): Promise<void> {
  await request(`/settings/api-keys/${provider}/${keyId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteApiKey(provider: string, keyId: string): Promise<void> {
  await request(`/settings/api-keys/${provider}/${keyId}`, { method: "DELETE" });
}

export async function activateApiKey(provider: string, keyId: string): Promise<void> {
  await request(`/settings/api-keys/${provider}/${keyId}/activate`, { method: "POST" });
}

export async function revealApiKey(provider: string, keyId: string): Promise<string> {
  const data = await request<{ plain_key: string }>(`/settings/api-keys/${provider}/${keyId}/reveal`);
  return data.plain_key;
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function listAgents(): Promise<Agent[]> {
  return request<Agent[]>("/agents");
}

export async function createAgent(body: AgentCreateRequest): Promise<Agent> {
  return request<Agent>("/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getAgent(id: string): Promise<Agent> {
  return request<Agent>(`/agents/${id}`);
}

export async function updateAgent(id: string, body: AgentUpdateRequest): Promise<Agent> {
  return request<Agent>(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await request(`/agents/${id}`, { method: "DELETE" });
}

export async function duplicateAgent(id: string): Promise<Agent> {
  return request<Agent>(`/agents/${id}/duplicate`, { method: "POST" });
}

// ── User settings (default provider/model) ───────────────────────────────────

export async function getUserSettings(): Promise<UserSettings> {
  return request<UserSettings>("/settings/defaults");
}

export async function patchUserSettings(body: Partial<UserSettings>): Promise<UserSettings> {
  return request<UserSettings>("/settings/defaults", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Provider catalogue + key testing ─────────────────────────────────────────

export async function listProviders(): Promise<ProviderCatalogItem[]> {
  return request<ProviderCatalogItem[]>("/settings/providers");
}

export async function fetchProviderModels(provider: string): Promise<string[]> {
  return request<string[]>(`/settings/providers/${provider}/models`);
}

export async function testProviderKey(
  provider: string,
  api_key: string,
): Promise<TestKeyResult> {
  return request<TestKeyResult>(`/settings/api-keys/${provider}/test`, {
    method: "POST",
    body: JSON.stringify({ api_key }),
  });
}

// ── SSE Stream ────────────────────────────────────────────────────────────────

export function buildChatStream(body: ChatRequest): { url: string; init: RequestInit } {
  const token = getToken();
  return {
    url: `${API_BASE}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": crypto.randomUUID(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
  };
}

```

---

## `lib/guestSettings.ts`

```ts
/**
 * GuestSettingsStore — localStorage-backed settings for unauthenticated users.
 *
 * Key: aichat.settings.guest
 * All keys stay 100% local; they are never sent to the backend for storage.
 * When the user logs in, server-side BYOK keys take over automatically
 * (the useChat hook reads isAuthenticated to decide which path to use).
 */

import type { GuestSettings } from "./types";
import { PROVIDERS } from "./types";

const STORAGE_KEY = "aichat.settings.guest";

const DEFAULT_SETTINGS: GuestSettings = {
  apiKeys: {},
  preferredProvider: "openai",
  preferredModelByProvider: {},
};

export function loadGuestSettings(): GuestSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GuestSettings>;
    return {
      apiKeys:                   parsed.apiKeys ?? {},
      preferredProvider:         parsed.preferredProvider ?? DEFAULT_SETTINGS.preferredProvider,
      preferredModelByProvider:  parsed.preferredModelByProvider ?? {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGuestSettings(s: GuestSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function updateGuestApiKey(provider: string, key: string): void {
  const s = loadGuestSettings();
  s.apiKeys[provider] = key;
  saveGuestSettings(s);
}

export function removeGuestApiKey(provider: string): void {
  const s = loadGuestSettings();
  delete s.apiKeys[provider];
  saveGuestSettings(s);
}

export function setPreferredProvider(provider: string): void {
  const s = loadGuestSettings();
  s.preferredProvider = provider;
  saveGuestSettings(s);
}

export function setPreferredModel(provider: string, model: string): void {
  const s = loadGuestSettings();
  s.preferredModelByProvider[provider] = model;
  saveGuestSettings(s);
}

/** Resolve the active model for a provider, falling back to the provider's defaultModel. */
export function resolveModel(settings: GuestSettings, provider: string): string {
  const explicit = settings.preferredModelByProvider[provider];
  if (explicit) return explicit;
  const cfg = PROVIDERS.find((p) => p.id === provider);
  return cfg?.defaultModel ?? "";
}

```

---

## `lib/personaSync.ts`

```ts
/**
 * Persona config sync helpers.
 *
 * Guest path  → stored in localStorage under PERSONA_KEY.
 * Auth path   → stored on server via PATCH /api/auth/me.
 *
 * After login the AuthContext calls resolvePersonaConflict() which
 * returns a ConflictResult the UI can act on.
 */

import type { PersonaConfig } from "./types";

export const PERSONA_STORAGE_KEY = "aichat.persona_config";

export const EMPTY_PERSONA: PersonaConfig = {
  persona: "",
  language: "",
  tone: "helpful",
};

// ── localStorage helpers ──────────────────────────────────────────────────────

export function loadLocalPersona(): PersonaConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersonaConfig;
  } catch {
    return null;
  }
}

export function saveLocalPersona(cfg: PersonaConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(cfg));
}

export function clearLocalPersona(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSONA_STORAGE_KEY);
}

export function isPersonaEmpty(cfg: PersonaConfig): boolean {
  return !cfg.persona && !cfg.language && (!cfg.tone || cfg.tone === "helpful");
}

// ── Conflict resolution ───────────────────────────────────────────────────────

export type ConflictResult =
  | { kind: "none" }                                    // nothing to do
  | { kind: "auto_upload"; localCfg: PersonaConfig }    // server was empty, auto-uploaded
  | { kind: "conflict"; localCfg: PersonaConfig; serverCfg: PersonaConfig }; // user must choose

/**
 * Call this right after a successful login/register.
 * Returns instructions for what to do; does NOT perform the PATCH itself
 * (the caller — AuthContext — handles it so we avoid a circular import with api.ts).
 */
export function resolvePersonaConflict(
  localCfg: PersonaConfig | null,
  serverCfg: PersonaConfig,
): ConflictResult {
  const localEmpty = !localCfg || isPersonaEmpty(localCfg);
  const serverEmpty = isPersonaEmpty(serverCfg);

  if (localEmpty) return { kind: "none" };
  if (serverEmpty) return { kind: "auto_upload", localCfg: localCfg! };
  return { kind: "conflict", localCfg: localCfg!, serverCfg };
}

```

---

## `lib/types.ts`

```ts
export interface PersonaConfig {
  persona: string;    // Free-form system-prompt persona text
  language: string;   // Preferred reply language, e.g. "vi", "en"
  tone: string;       // "helpful" | "formal" | "casual" | "concise"
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  persona_config?: PersonaConfig;
  default_provider: string;
  default_model: string;
}

export interface UserSettings {
  default_provider: string;
  default_model: string;
}

export interface ProviderCatalogItem {
  id: string;
  name: string;
  models: string[];
  default_model: string;
  key_prefix_hint: string;
}

export interface TestKeyResult {
  ok: boolean;
  message: string;
}

// ── Custom Agent ──────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  owner_user_id?: string;
  name: string;
  description?: string;
  system_prompt: string;
  model?: string;
  params: Record<string, unknown>;  // {"temperature": 0.7, "max_tokens": 2000}
  tools: string[];                  // ["web_search"]
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AgentCreateRequest {
  name: string;
  description?: string;
  system_prompt: string;
  model?: string;
  params?: Record<string, unknown>;
  tools?: string[];
  is_public?: boolean;
}

export interface AgentUpdateRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  params?: Record<string, unknown>;
  tools?: string[];
  is_public?: boolean;
}

export interface Conversation {
  id: string;
  title?: string;
  model_id?: string;
  is_archived: boolean;
  updated_at?: string;
}

export interface Citation {
  id: number;
  url: string;
  title?: string;
}

export interface Attachment {
  file: File;
  preview?: string;
  uploading?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  statusText?: string;         // "Routing to groq (CHATTER)…"
  citations?: Citation[];
  metadata?: {
    provider?: string;
    model?: string;
  };
}

export type SSEEventType = "status" | "citations" | "content" | "done" | "error";

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  delta?: string;
  links?: Citation[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    provider: string;
    model: string;
  };
  message?: string;
}

export interface ChatRequest {
  conversation_id?: string;
  model_preference?: "auto" | "speed" | "quality";
  messages: { role: string; content: string; attachments?: string[] }[];
  tools?: string[];
  stream?: boolean;
  // Provider / model override — used for guest mode and explicit selection.
  provider?: string;
  model?: string;
  api_key?: string;
  // Agent override — used when a specific agent is selected for the chat.
  agent_id?: string;
}

export interface QuotaInfo {
  used: number;
  limit: number;
}

// ── Provider catalogue ────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  name: string;
  placeholder: string;
  models: string[];
  defaultModel: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    name: "Groq",
    placeholder: "gsk_...",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "qwen/qwen3-32b",
      "groq/compound",
      "groq/compound-mini",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "openai/gpt-oss-safeguard-20b",
      "allam-2-7b",
      "whisper-large-v3",
      "whisper-large-v3-turbo",
      "meta-llama/llama-prompt-guard-2-86m",
      "meta-llama/llama-prompt-guard-2-22m",
      "canopylabs/orpheus-v1-english",
      "canopylabs/orpheus-arabic-saudi",
    ],
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    placeholder: "sk-or-...",
    models: [
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "openai/sora-2-pro",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-pro-1.5",
      "google/gemma-4-26b-a4b-it",
      "google/gemma-4-31b-it",
      "google/gemma-3n-e2b-it",
      "google/gemma-3n-e4b-it",
      "google/gemma-3-4b-it",
      "google/gemma-3-12b-it",
      "google/gemma-3-27b-it",
      "google/veo-3.1",
      "google/veo-3.1-fast",
      "google/veo-3.1-lite",
      "google/lyria-3-pro-preview",
      "google/lyria-3-clip-preview",
      "meta-llama/llama-3-70b-instruct",
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.2-3b-instruct",
      "mistralai/mistral-7b-instruct",
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3-nano-30b-a3b",
      "nvidia/nemotron-nano-12b-v2-vl",
      "nvidia/nemotron-nano-9b-v2",
      "nvidia/llama-nemotron-embed-vl-1b-v2",
      "qwen/qwen3-next-80b-a3b-instruct",
      "qwen/qwen3-coder",
      "minimax/hailuo-2.3",
      "minimax/minimax-m2.5",
      "bytedance/seedance-2.0",
      "bytedance/seedance-2.0-fast",
      "bytedance/seedance-1-5-pro",
      "bytedance-seed/seedream-4.5",
      "alibaba/wan-2.7",
      "alibaba/wan-2.6",
      "black-forest-labs/flux.2-pro",
      "black-forest-labs/flux.2-max",
      "black-forest-labs/flux.2-flex",
      "black-forest-labs/flux.2-klein-4b",
      "cohere/rerank-4-pro",
      "cohere/rerank-4-fast",
      "cohere/rerank-v3.5",
      "liquid/lfm-2.5-1.2b-thinking",
      "liquid/lfm-2.5-1.2b-instruct",
      "sourceful/riverflow-v2-pro",
      "sourceful/riverflow-v2-fast",
      "sourceful/riverflow-v2-max-preview",
      "sourceful/riverflow-v2-standard-preview",
      "sourceful/riverflow-v2-fast-preview",
      "nousresearch/hermes-3-llama-3.1-405b",
      "inclusionai/ling-2.6-1t",
      "inclusionai/ling-2.6-flash",
      "tencent/hy3-preview",
      "baidu/qianfan-ocr-fast",
      "kwaivgi/kling-video-o1",
      "z-ai/glm-4.5-air",
      "cognitivecomputations/dolphin-mistral-24b-venice-edition",
    ],
    defaultModel: "openai/gpt-4o",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    placeholder: "nvapi-...",
    models: [
      "meta/llama-4-maverick-17b-128e-instruct",
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-405b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.2-90b-vision-instruct",
      "meta/llama-3.2-11b-vision-instruct",
      "meta/llama-3.2-3b-instruct",
      "meta/llama-3.2-1b-instruct",
      "deepseek-ai/deepseek-v3.2",
      "deepseek-ai/deepseek-v3.1-terminus",
      "qwen/qwen3-coder-480b-a35b-instruct",
      "qwen/qwen3.5-397b-a17b",
      "qwen/qwen3.5-122b-a10b",
      "qwen/qwen3-next-80b-a3b-instruct",
      "qwen/qwen3-next-80b-a3b-thinking",
      "qwen/qwq-32b",
      "qwen/qwen2.5-coder-32b-instruct",
      "qwen/qwen2.5-7b-instruct",
      "qwen/qwen2.5-coder-7b-instruct",
      "qwen/qwen2-7b-instruct",
      "mistralai/mistral-large-3-675b-instruct-2512",
      "mistralai/devstral-2-123b-instruct-2512",
      "mistralai/ministral-14b-instruct-2512",
      "mistralai/mistral-small-4-119b-2603",
      "mistralai/magistral-small-2506",
      "mistralai/mistral-medium-3-instruct",
      "mistralai/mistral-small-3.1-24b-instruct-2503",
      "mistralai/mistral-small-24b-instruct",
      "mistralai/mistral-nemotron",
      "mistralai/mamba-codestral-7b-v0.1",
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3-nano-30b-a3b",
      "nvidia/nemotron-nano-12b-v2-vl",
      "nvidia/nvidia-nemotron-nano-9b-v2",
      "nvidia/llama-3.1-nemotron-nano-8b-v1",
      "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
      "nvidia/nemotron-mini-4b-instruct",
      "nvidia/nemotron-4-mini-hindi-4b-instruct",
      "nvidia/usdcode",
      "google/gemma-4-31b-it",
      "google/gemma-3-27b-it",
      "google/gemma-3n-e4b-it",
      "google/gemma-3n-e2b-it",
      "google/gemma-2-2b-it",
      "microsoft/phi-4-mini-flash-reasoning",
      "microsoft/phi-4-mini-instruct",
      "microsoft/phi-4-multimodal-instruct",
      "microsoft/phi-3.5-mini-instruct",
      "moonshotai/kimi-k2-instruct",
      "moonshotai/kimi-k2-thinking",
      "moonshotai/kimi-k2.5",
      "moonshotai/kimi-k2-instruct-0905",
      "minimaxai/minimax-m2.7",
      "minimaxai/minimax-m2.5",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "bytedance/seed-oss-36b-instruct",
      "stepfun-ai/step-3.5-flash",
      "z-ai/glm-5.1",
      "z-ai/glm-4.7",
      "marin/marin-8b-instruct",
      "sarvamai/sarvam-m",
      "stockmark/stockmark-2-100b-instruct",
      "abacusai/dracarys-llama-3.1-70b-instruct",
      "opengpt-x/teuken-7b-instruct-commercial-v0.4",
      "rakuten/rakutenai-7b-instruct",
      "rakuten/rakutenai-7b-chat",
      "nvidia/ising-calibration-1-35b-a3b",
    ],
    defaultModel: "meta/llama-4-maverick-17b-128e-instruct",
  },
  {
    id: "openai",
    name: "OpenAI",
    placeholder: "sk-...",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    defaultModel: "gpt-4o",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    placeholder: "sk-ant-...",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
      "claude-3-opus-20240229",
    ],
    defaultModel: "claude-3-5-sonnet-20241022",
  },
  {
    id: "google",
    name: "Google",
    placeholder: "AIza...",
    models: ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro"],
    defaultModel: "gemini-pro",
  },
  
];

// ── Provider key URLs (for quick navigation to API key pages) ────────────────

export const PROVIDER_KEY_URLS: Record<string, string> = {
  groq:       "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/settings/keys",
  nvidia:     "https://build.nvidia.com/",
  openai:     "https://platform.openai.com/api-keys",
  anthropic:  "https://console.anthropic.com/settings/keys",
  google:     "https://aistudio.google.com/app/apikey",
};

// ── Multi-key API types ───────────────────────────────────────────────────────

export interface StoredKeyInfo {
  id: string;
  label: string;
  is_active: boolean;
  masked_key: string;
}

export interface ProviderKeyGroup {
  provider: string;
  name: string;
  is_set: boolean;
  using_system_key: boolean;
  keys: StoredKeyInfo[];
}

// ── Guest settings (stored in localStorage) ──────────────────────────────────

export interface GuestSettings {
  /** Raw API keys per provider. Never sent to BE for storage — stays local only. */
  apiKeys: Record<string, string>;
  /** Provider the user prefers as default when opening a new chat. */
  preferredProvider: string;
  /** Per-provider model preference: { "openai": "gpt-4o-mini", ... } */
  preferredModelByProvider: Record<string, string>;
}

```

---

## `messages/en.json`

```json
{
  "nav": {
    "chat": "Chat",
    "agents": "Agents",
    "settings": "Settings",
    "logout": "Logout"
  },
  "chat": {
    "title": "Chat",
    "newChat": "New Chat",
    "provider": "Provider",
    "model": "Model",
    "selectProvider": "Select API Provider",
    "selectModel": "Select Model",
    "apiKey": "API Key",
    "enterApiKey": "Enter API Key",
    "send": "Send",
    "stop": "Stop",
    "typing": "Typing...",
    "loading": "Loading...",
    "noMessages": "No messages yet. Start a conversation!",
    "deleteChat": "Delete Chat",
    "confirmDelete": "Are you sure you want to delete this chat?",
    "error": "An error occurred",
    "retryMessage": "Retry"
  },
  "providers": {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "groq": "Groq",
    "google": "Google Gemini",
    "openrouter": "OpenRouter",
    "nvidia": "NVIDIA NIM"
  },
  "models": {
    "gpt4o": "GPT-4o",
    "gpt4oMini": "GPT-4o Mini",
    "claude35Sonnet": "Claude 3.5 Sonnet",
    "llama370b": "Llama 3-70B",
    "geminiPro": "Gemini Pro",
    "auto": "Auto"
  },
  "auth": {
    "login": "Login",
    "register": "Register",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "signIn": "Sign In",
    "signUp": "Sign Up",
    "forgotPassword": "Forgot Password?",
    "noAccount": "No account?",
    "hasAccount": "Already have an account?",
    "loginSuccess": "Login successful",
    "registerSuccess": "Registration successful"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "defaultProvider": "Default Provider",
    "defaultModel": "Default Model",
    "theme": "Theme",
    "apiKeys": "Manage API Keys",
    "notifications": "Notifications",
    "save": "Save",
    "saved": "Saved",
    "cancel": "Cancel"
  },
  "agents": {
    "title": "Agents",
    "newAgent": "New Agent",
    "name": "Name",
    "description": "Description",
    "systemPrompt": "System Prompt",
    "model": "Model",
    "temperature": "Temperature",
    "maxTokens": "Max Tokens",
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "noAgents": "No agents yet"
  },
  "common": {
    "ok": "OK",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "back": "Back",
    "next": "Next",
    "close": "Close",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "warning": "Warning",
    "info": "Info"
  }
}

```

---

## `messages/vi.json`

```json
{
  "nav": {
    "chat": "Trò chuyện",
    "agents": "Agents",
    "settings": "Cài đặt",
    "logout": "Đăng xuất"
  },
  "chat": {
    "title": "Chat",
    "newChat": "Trò chuyện mới",
    "provider": "Nhà cung cấp",
    "model": "Mô hình",
    "selectProvider": "Chọn nhà cung cấp API",
    "selectModel": "Chọn mô hình",
    "apiKey": "API Key",
    "enterApiKey": "Nhập API Key",
    "send": "Gửi",
    "stop": "Dừng",
    "typing": "Đang gõ...",
    "loading": "Đang tải...",
    "noMessages": "Không có tin nhắn nào. Bắt đầu cuộc trò chuyện!",
    "deleteChat": "Xóa trò chuyện",
    "confirmDelete": "Bạn có chắc chắn muốn xóa cuộc trò chuyện này?",
    "error": "Có lỗi xảy ra",
    "retryMessage": "Thử lại"
  },
  "providers": {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "groq": "Groq",
    "google": "Google Gemini",
    "openrouter": "OpenRouter",
    "nvidia": "NVIDIA NIM"
  },
  "models": {
    "gpt4o": "GPT-4o",
    "gpt4oMini": "GPT-4o Mini",
    "claude35Sonnet": "Claude 3.5 Sonnet",
    "llama370b": "Llama 3-70B",
    "geminiPro": "Gemini Pro",
    "auto": "Tự động"
  },
  "auth": {
    "login": "Đăng nhập",
    "register": "Đăng ký",
    "email": "Email",
    "password": "Mật khẩu",
    "confirmPassword": "Xác nhận mật khẩu",
    "signIn": "Đăng nhập",
    "signUp": "Đăng ký",
    "forgotPassword": "Quên mật khẩu?",
    "noAccount": "Không có tài khoản?",
    "hasAccount": "Đã có tài khoản?",
    "loginSuccess": "Đăng nhập thành công",
    "registerSuccess": "Đăng ký thành công"
  },
  "settings": {
    "title": "Cài đặt",
    "language": "Ngôn ngữ",
    "defaultProvider": "Nhà cung cấp mặc định",
    "defaultModel": "Mô hình mặc định",
    "theme": "Chủ đề",
    "apiKeys": "Quản lý API Keys",
    "notifications": "Thông báo",
    "save": "Lưu",
    "saved": "Đã lưu",
    "cancel": "Hủy"
  },
  "agents": {
    "title": "Agents",
    "newAgent": "Agent mới",
    "name": "Tên",
    "description": "Mô tả",
    "systemPrompt": "Prompt hệ thống",
    "model": "Mô hình",
    "temperature": "Nhiệt độ",
    "maxTokens": "Số token tối đa",
    "create": "Tạo",
    "edit": "Chỉnh sửa",
    "delete": "Xóa",
    "noAgents": "Không có agents nào"
  },
  "common": {
    "ok": "OK",
    "cancel": "Hủy",
    "save": "Lưu",
    "delete": "Xóa",
    "edit": "Chỉnh sửa",
    "back": "Quay lại",
    "next": "Tiếp theo",
    "close": "Đóng",
    "loading": "Đang tải...",
    "error": "Lỗi",
    "success": "Thành công",
    "warning": "Cảnh báo",
    "info": "Thông tin"
  }
}

```

---

## `middleware.ts`

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// No-op middleware: app uses its own I18nContext, not next-intl routing.
// next-intl/middleware was causing 404 on "/" when Accept-Language: en
// because it redirected to "/en/" which has no [locale] route group.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};

```

---

## `next-env.d.ts`

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.

```

---

## `next.config.mjs`

```mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

```

---

<!-- SKIPPED (non-source): package-lock.json -->
## `package.json`

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.4.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@heroicons/react": "^2.1.5",
    "@types/react-syntax-highlighter": "^15.5.13",
    "clsx": "^2.1.1",
    "eventsource-parser": "^1.1.2",
    "next": "14.2.29",
    "next-intl": "^3.10.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^10.1.0",
    "react-syntax-highlighter": "^16.1.1",
    "remark-gfm": "^4.0.1",
    "tailwind-merge": "^2.3.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^10.0.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.29",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5"
  }
}

```

---

## `postcss.config.js`

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

---

## `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: "#111827",
        "chat-bg": "#1f2937",
        "input-bg": "#374151",
        accent: "#6366f1",
        "accent-hover": "#4f46e5",
      },
      animation: {
        "pulse-dot": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.2s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

```

---

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

---

<!-- SKIPPED (non-source): tsconfig.tsbuildinfo -->

<!-- Tổng: 48 file(s) được tổng hợp, 0 file(s) bị bỏ qua (binary), 3 file(s) bị bỏ qua (non-source) -->
