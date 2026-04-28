import type {
  Conversation, ChatRequest, User, PersonaConfig,
  Agent, AgentCreateRequest, AgentUpdateRequest,
  AgentKnowledgeFile,
  UserSettings, ProviderCatalogItem, TestKeyResult,
  StoredKeyInfo, ProviderKeyGroup, AttachmentRef,
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

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  return request<Conversation>(`/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: { provider?: string; model?: string; attachments?: AttachmentRef[] } | null;
  created_at?: string;
}

export async function uploadFile(file: File): Promise<AttachmentRef> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Upload failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    url: `${API_BASE}/files/${data.id}`,
    content_type: data.content_type,
    size: data.size,
  };
}

export async function fetchConversationMessages(id: string): Promise<ConversationMessage[]> {
  return request<ConversationMessage[]>(`/conversations/${id}/messages`);
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

export async function listKnowledgeFiles(agentId: string): Promise<AgentKnowledgeFile[]> {
  return request<AgentKnowledgeFile[]>(`/agents/${agentId}/knowledge`);
}

export async function uploadKnowledgeFile(agentId: string, file: File): Promise<AgentKnowledgeFile> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/agents/${agentId}/knowledge`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Upload failed (HTTP ${res.status})`);
  }
  return res.json();
}

export async function deleteKnowledgeFile(agentId: string, knowledgeId: string): Promise<void> {
  await request(`/agents/${agentId}/knowledge/${knowledgeId}`, { method: "DELETE" });
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
