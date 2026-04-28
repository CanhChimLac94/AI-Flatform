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

export interface AgentKnowledgeFile {
  id: string;
  agent_id: string;
  file_id: string;
  name: string;
  content_type: string;
  size: number;
  created_at: string;
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
      "allam-2-7b",
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
      "anthropic/claude-3.5-sonnet",
      "google/gemini-pro-1.5",
      "google/gemma-4-26b-a4b-it",
      "google/gemma-4-31b-it",
      "google/gemma-3n-e2b-it",
      "google/gemma-3n-e4b-it",
      "google/gemma-3-4b-it",
      "google/gemma-3-12b-it",
      "google/gemma-3-27b-it",
      "google/gemma-3n-e2b-it:free",
      "google/gemma-3n-e4b-it:free",
      "google/gemma-3-4b-it:free",
      "google/gemma-3-12b-it:free",
      "google/gemma-3-27b-it:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "meta-llama/llama-3-70b-instruct",
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.2-3b-instruct",
      "mistralai/mistral-7b-instruct",
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3-nano-30b-a3b",
      "nvidia/nemotron-nano-12b-v2-vl",
      "nvidia/nemotron-nano-9b-v2",
      "qwen/qwen3-next-80b-a3b-instruct",
      "qwen/qwen3-coder",
      "qwen/qwen3-coder:free",
      "minimax/minimax-m2.5",
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
