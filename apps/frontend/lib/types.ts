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
  is_admin?: boolean;
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

export interface ProviderModelEntry {
  id: string;
  provider: string;
  model_id: string;
  display_name: string | null;
  is_enabled: boolean;
  is_builtin: boolean;
  sort_order: number;
}

export interface ProviderModelGroup {
  provider: string;
  provider_name: string;
  models: ProviderModelEntry[];
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
  icon?: string | null;
  categories?: AgentCategory[];
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
  icon?: string | null;
  category_ids?: string[];
}

export interface AgentUpdateRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  params?: Record<string, unknown>;
  tools?: string[];
  is_public?: boolean;
  icon?: string | null;
  category_ids?: string[];
}

/** Draft produced by the agent design chat (LLM-assisted creation). */
export interface AgentDraft {
  name: string;
  description?: string | null;
  system_prompt: string;
  model?: string | null;
  tools?: string[];
  icon?: string | null;
  category_slugs?: string[];
  is_public?: boolean;
}

export interface AgentDesignMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentDesignChatResponse {
  message: string;
  draft: AgentDraft | null;
  ready: boolean;
}

export interface AgentKnowledgeFile {
  id: string;
  agent_id: string;
  file_id: string;
  name: string;
  content_type: string;
  size: number;
  created_at: string;
}

// ── System agents (shared catalog) ───────────────────────────────────────────

export interface AgentCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string | null;
  sort_order: number;
}

export interface AgentCategoryCreateRequest {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string | null;
  sort_order?: number;
}

export interface AgentCategoryUpdateRequest {
  name?: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string | null;
  sort_order?: number;
}

export interface SystemAgent {
  id: string;
  owner_user_id: string;
  name: string;
  description?: string;
  system_prompt: string;
  model?: string;
  params: Record<string, unknown>;
  tools: string[];
  icon?: string | null;
  is_system: boolean;
  categories: AgentCategory[];
  created_at?: string;
  updated_at?: string;
}

export interface SystemAgentCreateRequest {
  name: string;
  description?: string;
  system_prompt: string;
  model?: string;
  params?: Record<string, unknown>;
  tools?: string[];
  icon?: string | null;
  category_ids: string[];
}

export interface SystemAgentUpdateRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  params?: Record<string, unknown>;
  tools?: string[];
  icon?: string | null;
  category_ids?: string[];
}

// ── Agent flows (Flow Designer) ────────────────────────────────────────────────

export interface FlowGraph {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  version: string;
}

export interface AgentFlowSummary {
  id: string;
  owner_user_id: string;
  name: string;
  description?: string | null;
  node_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
  schedule_enabled?: boolean | null;
  schedule_frequency?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
}

export interface AgentFlow extends AgentFlowSummary {
  graph: FlowGraph;
}

export type FlowFrequency = "once" | "hourly" | "daily" | "weekly";

export interface FlowSchedule {
  id: string;
  flow_id: string;
  enabled: boolean;
  frequency: FlowFrequency;
  run_at?: string | null;
  interval_minutes?: number | null;
  time_of_day?: string | null;
  day_of_week?: number | null;
  timezone: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowScheduleUpsertRequest {
  enabled: boolean;
  frequency: FlowFrequency;
  run_at?: string;
  interval_minutes?: number;
  time_of_day?: string;
  day_of_week?: number;
  timezone?: string;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
  result: Record<string, unknown>;
  error_message?: string | null;
}

export interface FlowCreateRequest {
  name: string;
  description?: string;
  graph?: FlowGraph;
}

export interface FlowUpdateRequest {
  name?: string;
  description?: string;
  graph?: FlowGraph;
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

export interface AttachmentRef {
  id: string;
  name: string;
  url: string;         // frontend-accessible URL: /api/files/{id}
  content_type: string;
  size: number;
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
  attachments?: AttachmentRef[];
  metadata?: {
    provider?: string;
    model?: string;
  };
}

export type SSEEventType = "status" | "citations" | "content" | "done" | "error" | "conv_update";

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
  conv_id?: string;
  title?: string;
}

export interface ChatRequest {
  conversation_id?: string;
  model_preference?: "auto" | "speed" | "quality";
  messages: { role: string; content: string; attachments?: AttachmentRef[] }[];
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
  defaultModel: string;
}

/** Provider metadata only — model lists are stored in the DB catalog. */
export const PROVIDERS: ProviderConfig[] = [
  { id: "groq", name: "Groq", placeholder: "gsk_...", defaultModel: "llama-3.3-70b-versatile" },
  { id: "nvidia", name: "NVIDIA NIM", placeholder: "nvapi-...", defaultModel: "meta/llama-4-maverick-17b-128e-instruct" },
  { id: "openrouter", name: "OpenRouter", placeholder: "sk-or-...", defaultModel: "openai/gpt-4o-mini" },
  { id: "openai", name: "OpenAI", placeholder: "sk-...", defaultModel: "gpt-4o-mini" },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-...", defaultModel: "claude-3-5-sonnet-20241022" },
  { id: "google", name: "Google Gemini", placeholder: "AIza...", defaultModel: "gemini-pro" },
];

export interface ProviderModelExportPayload {
  provider: string;
  provider_name: string;
  exported_at: string;
  models: Array<{
    model_id: string;
    display_name: string | null;
    is_enabled: boolean;
    is_builtin: boolean;
    sort_order: number;
  }>;
}

// ── Provider key URLs (for quick navigation to API key pages) ────────────────

export const PROVIDER_KEY_URLS: Record<string, string> = {
  groq:       "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/settings/keys",
  nvidia:     "https://build.nvidia.com/settings/api-keys",
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

export type ProviderKeyStatusCode =
  | "chat_ready"
  | "no_key"
  | "no_active_key"
  | "key_not_usable"
  | "no_enabled_models"
  | "unavailable";

export interface ProviderChannelStatus {
  chat_ready: boolean;
  has_stored_keys: boolean;
  has_active_key: boolean;
  key_usable: boolean;
  enabled_models_count: number;
  status_code: ProviderKeyStatusCode;
}

export interface ProviderKeyGroup {
  provider: string;
  name: string;
  is_set: boolean;
  using_system_key: boolean;
  keys: StoredKeyInfo[];
  channel_status: ProviderChannelStatus;
}

// ── Guest settings ───────────────────────────────────────────────────────────

export interface GuestSettings {
  /** Session-only API keys (sessionStorage); cleared on reload. */
  apiKeys: Record<string, string>;
  /** Provider the user prefers as default when opening a new chat. */
  preferredProvider: string;
  /** Per-provider model preference: { "openai": "gpt-4o-mini", ... } */
  preferredModelByProvider: Record<string, string>;
  /** @deprecated Models are stored in server DB catalog only. */
  providerModels?: Record<string, ProviderModelEntry[]>;
}
