"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { NodeData } from "./types";
import { OutputActions } from "./OutputActions";
import { EXPORT_FORMAT_VALUES, type OutputFileFormat } from "./outputExport";
import { FlowIcon, type FlowIconKey } from "./flowIcons";
import { useI18n } from "@/contexts/I18nContext";

const FIELD_INPUT =
  "bg-input-bg border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-foreground outline-none w-full";
const HANDLE_BORDER = "!border-2 !border-surface";

interface NodeContainerProps {
  id: string;
  children: React.ReactNode;
  selected?: boolean;
  title: string;
  icon: FlowIconKey;
  colorClass: string;
  iconColor: string;
  data: NodeData;
}

function NodeContainer({ id, children, selected, title, icon, colorClass, iconColor, data }: NodeContainerProps) {
  const { setNodes } = useReactFlow();

  const toggleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, isEditing: !n.data.isEditing } } : n))
    );
  };

  const deleteNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
  };

  const runNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status: "running" } } : n))
    );
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, status: "success" } } : n))
      );
    }, 1500);
  };

  return (
    <div
      className={`min-w-[280px] bg-surface border-2 ${
        selected ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)]" : "border-border"
      } rounded-2xl shadow-lg overflow-hidden transition-all duration-200`}
    >
      <div className={`px-4 py-2.5 flex items-center justify-between border-b border-border ${colorClass}`}>
        <div className="flex items-center gap-2">
          <FlowIcon icon={icon} className={`w-[18px] h-[18px] ${iconColor}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">{title}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={runNode}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-hover text-green-700 dark:text-green-400 transition-colors"
          >
            <FlowIcon icon="play" className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={toggleEdit}
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors ${
              data.isEditing ? "text-blue-700 dark:text-blue-400 bg-surface-elevated" : "text-muted"
            }`}
          >
            <FlowIcon icon="settings" className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={deleteNode}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-red-600 dark:text-red-400 transition-colors"
          >
            <FlowIcon icon="delete" className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">{children}</div>

      {data.status === "running" && (
        <div className="h-1 w-full bg-blue-500/20 overflow-hidden">
          <div className="h-full bg-blue-500 flow-loading-bar" style={{ width: "30%" }} />
        </div>
      )}
    </div>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] text-muted uppercase font-bold tracking-wider px-1">{label}</label>
      {children}
    </div>
  );
}

interface CustomNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
}

export function StartNode({ id, data, selected }: CustomNodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const updateData = (field: string, val: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  return (
    <NodeContainer
      id={id}
      title={t("flows.nodes.start.title", "Input")}
      icon="input"
      colorClass="bg-blue-500/10 dark:bg-blue-500/5"
      iconColor="text-blue-700 dark:text-blue-400"
      selected={selected}
      data={data}
    >
      {data.isEditing ? (
        <div className="flex flex-col gap-3">
          <ConfigField label={t("flows.nodes.start.nodeName", "Node name")}>
            <input
              value={data.label}
              onChange={(e) => updateData("label", e.target.value)}
              className={`${FIELD_INPUT} focus:border-blue-500/50`}
            />
          </ConfigField>
          <ConfigField label={t("flows.nodes.start.data", "Data")}>
            <textarea
              value={data.value}
              onChange={(e) => updateData("value", e.target.value)}
              className={`${FIELD_INPUT} focus:border-blue-500/50 min-h-[80px] resize-none`}
            />
          </ConfigField>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-foreground">{data.label}</span>
          <div className="bg-surface-muted p-2.5 rounded-xl border border-border text-[11px] text-muted italic leading-relaxed min-h-[40px]">
            {data.value || t("flows.nodes.start.waiting", "Waiting for data…")}
          </div>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-2.5 !h-2.5 !bg-blue-500 ${HANDLE_BORDER} !-right-[6px]`}
      />
    </NodeContainer>
  );
}

export function AgentNode({ id, data, selected }: CustomNodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const updateData = (field: string, val: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  return (
    <NodeContainer
      id={id}
      title={t("flows.nodes.agent.title", "AI Agent")}
      icon="agent"
      colorClass="bg-purple-500/10 dark:bg-purple-500/5"
      iconColor="text-purple-700 dark:text-purple-400"
      selected={selected}
      data={data}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2.5 !h-2.5 !bg-border ${HANDLE_BORDER} !-left-[6px]`}
      />

      {data.isEditing ? (
        <div className="flex flex-col gap-3">
          <ConfigField label={t("flows.nodes.agent.agentName", "Agent name")}>
            <input
              value={data.label}
              onChange={(e) => updateData("label", e.target.value)}
              className={`${FIELD_INPUT} focus:border-purple-500/50`}
            />
          </ConfigField>
          <ConfigField label={t("flows.nodes.agent.model", "Model")}>
            <select
              value={data.model}
              onChange={(e) => updateData("model", e.target.value)}
              className={`${FIELD_INPUT} focus:border-purple-500/50 cursor-pointer`}
            >
              <option value="Gemini">{t("flows.nodes.agent.modelGemini", "Gemini Pro")}</option>
              <option value="GPT-4o">{t("flows.nodes.agent.modelGpt4o", "GPT-4o")}</option>
              <option value="Claude">{t("flows.nodes.agent.modelClaude", "Claude")}</option>
            </select>
          </ConfigField>
          <ConfigField label={t("flows.nodes.agent.prompt", "Instructions (prompt)")}>
            <textarea
              value={data.prompt}
              onChange={(e) => updateData("prompt", e.target.value)}
              className={`${FIELD_INPUT} focus:border-purple-500/50 min-h-[100px] resize-none`}
            />
          </ConfigField>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start gap-2">
            <span className="text-[13px] font-bold text-foreground leading-tight">{data.label}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30 font-bold whitespace-nowrap uppercase">
              {data.model || "Gemini"}
            </span>
          </div>
          <div className="h-[1px] w-full bg-border" />
          <p className="text-[10px] text-muted line-clamp-3 leading-relaxed italic">
            {data.prompt || t("flows.nodes.agent.noPrompt", "No instructions set.")}
          </p>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-2.5 !h-2.5 !bg-purple-500 ${HANDLE_BORDER} !-right-[6px]`}
      />
    </NodeContainer>
  );
}

export function OutputNode({ id, data, selected }: CustomNodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const exportFormat = (data.exportFormat ?? "auto") as OutputFileFormat;

  const updateData = (field: string, val: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  return (
    <NodeContainer
      id={id}
      title={t("flows.nodes.output.title", "Output")}
      icon="terminal"
      colorClass="bg-green-500/10 dark:bg-green-500/5"
      iconColor="text-green-700 dark:text-green-400"
      selected={selected}
      data={data}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2.5 !h-2.5 !bg-border ${HANDLE_BORDER} !-left-[6px]`}
      />

      {data.isEditing ? (
        <div className="flex flex-col gap-3">
          <ConfigField label={t("flows.nodes.output.outputName", "Output name")}>
            <input
              value={data.label}
              onChange={(e) => updateData("label", e.target.value)}
              className={`${FIELD_INPUT} focus:border-green-500/50`}
            />
          </ConfigField>
          <ConfigField label={t("flows.nodes.output.exportFormat", "Default export format")}>
            <select
              value={exportFormat}
              onChange={(e) => updateData("exportFormat", e.target.value)}
              className={`${FIELD_INPUT} focus:border-green-500/50 cursor-pointer`}
            >
              {EXPORT_FORMAT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`flows.exportFormats.${value}`, value.toUpperCase())}
                </option>
              ))}
            </select>
          </ConfigField>
          <ConfigField label={t("flows.nodes.output.content", "Result content")}>
            <textarea
              value={data.value ?? ""}
              onChange={(e) => updateData("value", e.target.value)}
              placeholder={t("flows.nodes.output.contentPlaceholder", "Enter content or run the flow to get results…")}
              className={`${FIELD_INPUT} focus:border-green-500/50 min-h-[100px] resize-none font-mono`}
            />
          </ConfigField>
          <OutputActions content={data.value} label={data.label} preferredFormat={exportFormat} />
        </div>
      ) : (
        <span className="text-[13px] font-bold text-foreground">{data.label}</span>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] text-muted uppercase font-bold tracking-wider">
            {t("flows.nodes.output.console", "Console")}
          </span>
          <OutputActions
            content={data.value}
            label={data.label}
            preferredFormat={exportFormat}
            compact
          />
        </div>
        <div className="bg-surface-muted p-3 rounded-xl border border-border min-h-[80px] max-h-[200px] overflow-y-auto flow-scrollbar font-mono shadow-inner">
          <p className="text-[10px] text-green-700 dark:text-green-400 leading-snug whitespace-pre-wrap break-words">
            <span className="text-muted mr-1">$</span>
            {data.value || t("flows.nodes.output.waiting", "Waiting for signal…")}
          </p>
        </div>
      </div>
    </NodeContainer>
  );
}
