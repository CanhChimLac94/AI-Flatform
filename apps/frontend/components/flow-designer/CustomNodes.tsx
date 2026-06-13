"use client";

import { Handle, Position, useReactFlow } from "@xyflow/react";
import type { NodeData } from "./types";
import { OutputActions } from "./OutputActions";
import { EXPORT_FORMAT_OPTIONS } from "./outputExport";
import type { OutputFileFormat } from "./outputExport";

interface NodeContainerProps {
  id: string;
  children: React.ReactNode;
  selected?: boolean;
  title: string;
  icon: string;
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
      className={`min-w-[280px] bg-[#1a1a1a] border-2 ${
        selected ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : "border-[#333]"
      } rounded-2xl shadow-2xl overflow-hidden transition-all duration-200`}
    >
      <div className={`px-4 py-2.5 flex items-center justify-between border-b border-white/5 ${colorClass}`}>
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${iconColor}`}>{icon}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{title}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={runNode}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-green-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
          </button>
          <button
            onClick={toggleEdit}
            className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors ${
              data.isEditing ? "text-blue-400 bg-white/10" : "text-white/40"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button
            onClick={deleteNode}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
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
      <label className="text-[9px] text-white/30 uppercase font-bold tracking-wider px-1">{label}</label>
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
  const { setNodes } = useReactFlow();
  const updateData = (field: string, val: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  return (
    <NodeContainer
      id={id}
      title="Đầu vào"
      icon="input"
      colorClass="bg-blue-500/5"
      iconColor="text-blue-400"
      selected={selected}
      data={data}
    >
      {data.isEditing ? (
        <div className="flex flex-col gap-3">
          <ConfigField label="Tên Node">
            <input
              value={data.label}
              onChange={(e) => updateData("label", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/50"
            />
          </ConfigField>
          <ConfigField label="Dữ liệu">
            <textarea
              value={data.value}
              onChange={(e) => updateData("value", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-blue-500/50 min-h-[80px] resize-none"
            />
          </ConfigField>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-white">{data.label}</span>
          <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 text-[11px] text-blue-100/70 italic leading-relaxed min-h-[40px]">
            {data.value || "Đang chờ dữ liệu..."}
          </div>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-[#1a1a1a] !-right-[6px]"
      />
    </NodeContainer>
  );
}

export function AgentNode({ id, data, selected }: CustomNodeProps) {
  const { setNodes } = useReactFlow();
  const updateData = (field: string, val: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [field]: val } } : n))
    );
  };

  return (
    <NodeContainer
      id={id}
      title="AI Agent"
      icon="smart_toy"
      colorClass="bg-purple-500/5"
      iconColor="text-purple-400"
      selected={selected}
      data={data}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#555] !border-2 !border-[#1a1a1a] !-left-[6px]"
      />

      {data.isEditing ? (
        <div className="flex flex-col gap-3">
          <ConfigField label="Tên Agent">
            <input
              value={data.label}
              onChange={(e) => updateData("label", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-purple-500/50"
            />
          </ConfigField>
          <ConfigField label="Mô hình">
            <select
              value={data.model}
              onChange={(e) => updateData("model", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="Gemini">Gemini Pro</option>
              <option value="GPT-4o">GPT-4o</option>
              <option value="Claude">Claude</option>
            </select>
          </ConfigField>
          <ConfigField label="Chỉ dẫn (Prompt)">
            <textarea
              value={data.prompt}
              onChange={(e) => updateData("prompt", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-purple-500/50 min-h-[100px] resize-none"
            />
          </ConfigField>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start gap-2">
            <span className="text-[13px] font-bold text-white leading-tight">{data.label}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold whitespace-nowrap uppercase">
              {data.model || "Gemini"}
            </span>
          </div>
          <div className="h-[1px] w-full bg-white/5" />
          <p className="text-[10px] text-white/50 line-clamp-3 leading-relaxed italic">
            {data.prompt || "Chưa thiết lập chỉ dẫn."}
          </p>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-purple-500 !border-2 !border-[#1a1a1a] !-right-[6px]"
      />
    </NodeContainer>
  );
}

export function OutputNode({ id, data, selected }: CustomNodeProps) {
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
      title="Kết quả"
      icon="terminal"
      colorClass="bg-green-500/5"
      iconColor="text-green-400"
      selected={selected}
      data={data}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#555] !border-2 !border-[#1a1a1a] !-left-[6px]"
      />

      {data.isEditing ? (
        <div className="flex flex-col gap-3">
          <ConfigField label="Tên Output">
            <input
              value={data.label}
              onChange={(e) => updateData("label", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-green-500/50"
            />
          </ConfigField>
          <ConfigField label="Định dạng xuất mặc định">
            <select
              value={exportFormat}
              onChange={(e) => updateData("exportFormat", e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-green-500/50 cursor-pointer"
            >
              {EXPORT_FORMAT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </ConfigField>
          <ConfigField label="Nội dung kết quả">
            <textarea
              value={data.value ?? ""}
              onChange={(e) => updateData("value", e.target.value)}
              placeholder="Nhập hoặc chạy flow để nhận kết quả..."
              className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-green-500/50 min-h-[100px] resize-none font-mono"
            />
          </ConfigField>
          <OutputActions content={data.value} label={data.label} preferredFormat={exportFormat} />
        </div>
      ) : (
        <span className="text-[13px] font-bold text-white">{data.label}</span>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] text-white/30 uppercase font-bold tracking-wider">Console</span>
          <OutputActions
            content={data.value}
            label={data.label}
            preferredFormat={exportFormat}
            compact
          />
        </div>
        <div className="bg-black/60 p-3 rounded-xl border border-white/5 min-h-[80px] max-h-[200px] overflow-y-auto flow-dark-scrollbar font-mono shadow-inner">
          <p className="text-[10px] text-green-400/80 leading-snug whitespace-pre-wrap break-words">
            <span className="text-white/20 mr-1">$</span>
            {data.value || "Hệ thống đang đợi tín hiệu..."}
          </p>
        </div>
      </div>
    </NodeContainer>
  );
}
