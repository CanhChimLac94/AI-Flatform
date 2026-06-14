"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { Agent, SystemAgent } from "@/lib/types";
import { GroupedModelSelect } from "@/components/common/GroupedModelSelect";
import { useChatModelCatalog } from "@/hooks/useChatModelCatalog";
import { getProviderVisual } from "@/lib/providerVisuals";
import { AgentIcon } from "@/components/agents/AgentIcon";
import { useI18n } from "@/contexts/I18nContext";

export type ModelPref = "auto" | "speed" | "quality";

const MODEL_PREF_KEYS: { id: ModelPref; labelKey: string; icon?: React.ComponentType<{ className?: string }> }[] = [
  { id: "auto", labelKey: "chat.modelPref.auto" },
  { id: "speed", labelKey: "chat.modelPref.speed", icon: BoltIcon },
  { id: "quality", labelKey: "chat.modelPref.quality", icon: SparklesIcon },
];

interface ChatOptionsMenuProps {
  modelPref: ModelPref;
  onModelPrefChange: (v: ModelPref) => void;
  webSearch: boolean;
  onWebSearchChange: (v: boolean) => void;
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (v: string) => void;
  onModelChange: (v: string) => void;
  agents: Agent[];
  systemAgents: SystemAgent[];
  activeAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  disabled?: boolean;
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 px-3 border-b border-gray-800 last:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{title}</p>
      {children}
    </div>
  );
}

export function ChatOptionsMenu({
  modelPref,
  onModelPrefChange,
  webSearch,
  onWebSearchChange,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  agents,
  systemAgents,
  activeAgentId,
  onSelectAgent,
  disabled = false,
}: ChatOptionsMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { groups: modelGroups, loading: loadingCatalog } = useChatModelCatalog();
  const rootRef = useRef<HTMLDivElement>(null);

  const allAgents = [
    ...agents.map((a) => ({ ...a, kind: "personal" as const })),
    ...systemAgents.map((a) => ({ ...a, kind: "system" as const })),
  ];
  const activeAgent = allAgents.find((a) => a.id === activeAgentId) ?? null;
  const activePrefKey = `chat.modelPref.${modelPref}`;
  const providerVisual = selectedProvider ? getProviderVisual(selectedProvider) : null;
  const hasExtras = webSearch || Boolean(activeAgent);

  const close = () => setOpen(false);

  useEffect(() => {
    if (loadingCatalog || modelGroups.length === 0) return;

    const isValid = modelGroups.some(
      (g) =>
        g.provider === selectedProvider &&
        g.models.some((m) => m.model_id === selectedModel),
    );
    if (isValid) return;

    const firstGroup = modelGroups[0];
    const firstModel = firstGroup?.models[0];
    if (!firstGroup || !firstModel) return;

    onProviderChange(firstGroup.provider);
    onModelChange(firstModel.model_id);
  }, [
    loadingCatalog,
    modelGroups,
    selectedProvider,
    selectedModel,
    onProviderChange,
    onModelChange,
  ]);

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

  const handleModelChange = (modelId: string, provider?: string) => {
    if (provider) onProviderChange(provider);
    onModelChange(modelId);
  };

  const triggerLabel = [
    t(activePrefKey),
    providerVisual?.name,
    activeAgent?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("chat.options.title")}
        title={t("chat.options.title")}
        className={`inline-flex items-center gap-1 max-w-[9rem] sm:max-w-[11rem] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open || hasExtras
            ? "text-accent bg-indigo-900/30 border border-indigo-700/50"
            : "text-gray-500 hover:text-gray-300 border border-transparent hover:bg-gray-800/60"
        }`}
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4 shrink-0" />
        <span className="truncate hidden min-[400px]:inline">{triggerLabel}</span>
        {hasExtras && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 min-[400px]:hidden" />}
        <ChevronDownIcon className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-[min(20rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-50"
        >
          <MenuSection title={t("chat.options.responseMode")}>
            <div className="flex gap-1">
              {MODEL_PREF_KEYS.map(({ id, labelKey, icon: Icon }) => {
                const selected = modelPref === id;
                const label = t(labelKey);
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => { onModelPrefChange(id); }}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selected
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-600"
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </MenuSection>

          <MenuSection title={t("chat.model")}>
            {!loadingCatalog && modelGroups.length === 0 ? (
              <p className="text-xs text-gray-500 px-1 py-1">
                {t(
                  "chat.options.noConfiguredModels",
                  "No channels ready for chat. Add API keys and enable models in Settings.",
                )}
              </p>
            ) : (
              <GroupedModelSelect
                groups={modelGroups}
                value={selectedModel}
                valueProvider={selectedProvider}
                onChange={handleModelChange}
                allowEmpty={false}
                emptyOption={t("common.loading", "Loading...")}
                loading={loadingCatalog}
                disabled={disabled}
                className="w-full px-2.5 py-2 text-sm bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
            )}
          </MenuSection>

          {allAgents.length > 0 && (
            <MenuSection title={t("chat.options.agent")}>
              <div className="max-h-36 overflow-y-auto -mx-1 rounded-lg border border-gray-800">
                {activeAgent && (
                  <button
                    type="button"
                    onClick={() => { onSelectAgent(null); close(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs text-gray-400 hover:bg-gray-800 border-b border-gray-800"
                  >
                    <XMarkIcon className="w-3.5 h-3.5 shrink-0" />
                    {t("chat.options.noAgent")}
                  </button>
                )}
                {agents.length > 0 && (
                  <>
                    <p className="px-2.5 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">{t("chat.options.personal")}</p>
                    {agents.map((agent) => (
                      <AgentMenuItem
                        key={agent.id}
                        id={agent.id}
                        name={agent.name}
                        icon={agent.icon}
                        active={agent.id === activeAgentId}
                        onSelect={() => { onSelectAgent(agent.id); close(); }}
                      />
                    ))}
                  </>
                )}
                {systemAgents.length > 0 && (
                  <>
                    <p className="px-2.5 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">{t("chat.options.system")}</p>
                    {systemAgents.map((agent) => (
                      <AgentMenuItem
                        key={agent.id}
                        id={agent.id}
                        name={agent.name}
                        icon={agent.icon}
                        categories={agent.categories}
                        system
                        active={agent.id === activeAgentId}
                        onSelect={() => { onSelectAgent(agent.id); close(); }}
                      />
                    ))}
                  </>
                )}
              </div>
            </MenuSection>
          )}

          <MenuSection title={t("chat.options.tools")}>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={webSearch}
              onClick={() => onWebSearchChange(!webSearch)}
              className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                webSearch ? "bg-indigo-900/30 text-indigo-200" : "bg-gray-800 text-gray-300 hover:bg-gray-700/80"
              }`}
            >
              <span className="flex items-center gap-2">
                <GlobeAltIcon className="w-4 h-4 shrink-0" />
                {t("chat.options.webSearch")}
              </span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  webSearch ? "bg-accent" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    webSearch ? "translate-x-[18px]" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </MenuSection>
        </div>
      )}
    </div>
  );
}

function AgentMenuItem({
  name,
  icon,
  categories,
  active,
  system,
  onSelect,
}: {
  id: string;
  name: string;
  icon?: string | null;
  categories?: SystemAgent["categories"];
  active: boolean;
  system?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors ${
        active
          ? system
            ? "bg-emerald-900/25 text-emerald-300"
            : "bg-blue-900/25 text-blue-300"
          : "text-gray-300 hover:bg-gray-800"
      }`}
    >
      <AgentIcon
        icon={icon}
        name={name}
        categories={categories}
        containerClassName="flex items-center justify-center w-6 h-6 rounded-md bg-gray-800 border border-gray-700 shrink-0"
        className={`w-3 h-3 ${system ? "text-emerald-400" : "text-blue-400"}`}
      />
      <span className="flex-1 truncate">{name}</span>
      {active && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
    </button>
  );
}
