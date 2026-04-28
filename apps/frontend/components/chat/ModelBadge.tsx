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
