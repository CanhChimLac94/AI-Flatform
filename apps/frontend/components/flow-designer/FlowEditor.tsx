"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Connection, Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StartNode, AgentNode, OutputNode } from "./CustomNodes";
import { DraggableNodeItem } from "./DraggableNodeItem";
import { TemplateItem } from "./TemplateItem";
import { FLOW_TEMPLATES } from "./constants";
import { FlowAgentDraggableItem } from "./FlowAgentDraggableItem";
import { FlowAgentCategorySection } from "./FlowAgentCategorySection";
import { FlowCategoryFilter } from "./FlowCategoryFilter";
import { useFlowAgents } from "./useFlowAgents";
import { filterAgentGroupsByCategory, filterAgentsByCategory } from "./flowAgentPalette";
import type { NodeType } from "./types";
import { downloadOutputFile, isExportableOutput } from "./outputExport";
import type { OutputFileFormat } from "./outputExport";
import { MobileMenuButton } from "@/components/layout/MobileMenuButton";
import { useAuth } from "@/contexts/AuthContext";
import { FlowIcon } from "./flowIcons";
import { createFlow, getFlow, updateFlow } from "@/lib/api";
import { createGuestFlow, getGuestFlow, updateGuestFlow } from "@/lib/flowStore";

const nodeTypes = {
  start: StartNode,
  agent: AgentNode,
  output: OutputNode,
};
const initialNodes: Node[] = [
  {
    id: "start-1",
    type: "start",
    position: { x: 50, y: 150 },
    data: { label: "Dữ liệu đầu vào", value: "Dự án: Hệ thống quản lý kho thông minh" },
  },
  {
    id: "output-1",
    type: "output",
    position: { x: 800, y: 150 },
    data: { label: "Sản phẩm hoàn thiện", value: "Hệ thống đang sẵn sàng..." },
  },
];

function downloadJson(data: object, filename: string) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FlowEditorInner({ flowId = null }: { flowId?: string | null }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { userAgents, systemAgents, systemAgentGroups, categories, sampleAgents, loading: agentsLoading, error: agentsError } =
    useFlowAgents(isAuthenticated);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [resolvedFlowId, setResolvedFlowId] = useState<string | null>(flowId);
  const [flowName, setFlowName] = useState("");
  const [flowLoading, setFlowLoading] = useState(Boolean(flowId));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!flowId) {
      setResolvedFlowId(null);
      setFlowName("");
      setFlowLoading(false);
      setSaveError(null);
      setNodes(initialNodes);
      setEdges([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setFlowLoading(true);
      setSaveError(null);
      try {
        const flow = isAuthenticated
          ? await getFlow(flowId)
          : getGuestFlow(flowId);
        if (!flow) {
          throw new Error("Không tìm thấy flow hoặc bạn không có quyền truy cập.");
        }
        if (cancelled) return;
        setResolvedFlowId(flow.id);
        setFlowName(flow.name);
        setNodes((flow.graph.nodes ?? []) as Node[]);
        setEdges((flow.graph.edges ?? []) as Edge[]);
        setTimeout(() => fitView({ padding: 0.2 }), 80);
      } catch (e: unknown) {
        if (!cancelled) {
          setSaveError(e instanceof Error ? e.message : "Không tải được flow");
        }
      } finally {
        if (!cancelled) setFlowLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [flowId, isAuthenticated, fitView, setNodes, setEdges]);

  const saveFlow = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const graph = {
      nodes: getNodes(),
      edges: getEdges(),
      version: "1.0",
    };

    try {
      if (isAuthenticated) {
        if (resolvedFlowId) {
          await updateFlow(resolvedFlowId, { graph });
        } else {
          const created = await createFlow({
            name: flowName || `Flow ${new Date().toLocaleDateString("vi-VN")}`,
            graph,
          });
          setResolvedFlowId(created.id);
          setFlowName(created.name);
          router.replace(`/agents/flow/${created.id}`);
        }
      } else if (resolvedFlowId) {
        updateGuestFlow(resolvedFlowId, { graph });
      } else {
        const created = createGuestFlow({
          name: flowName || "Flow mới",
          graph,
        });
        setResolvedFlowId(created.id);
        setFlowName(created.name);
        router.replace(`/agents/flow/${created.id}`);
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Lưu flow thất bại");
    } finally {
      setSaving(false);
    }
  }, [flowName, getEdges, getNodes, isAuthenticated, resolvedFlowId, router]);

  const hasUncategorizedAgents = useMemo(
    () =>
      [...userAgents, ...systemAgents].some((a) => !a.categories?.length),
    [userAgents, systemAgents],
  );

  const filteredUserAgents = useMemo(
    () => filterAgentsByCategory(userAgents, categoryFilter),
    [userAgents, categoryFilter],
  );

  const filteredSystemGroups = useMemo(
    () => filterAgentGroupsByCategory(systemAgentGroups, categoryFilter),
    [systemAgentGroups, categoryFilter],
  );

  const filteredSystemAgents = useMemo(
    () => filterAgentsByCategory(systemAgents, categoryFilter),
    [systemAgents, categoryFilter],
  );

  const hasFilteredAgents =
    filteredUserAgents.length > 0 || filteredSystemAgents.length > 0;

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const applyTemplate = (templateId: string) => {
    const template = FLOW_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setNodes(template.nodes);
      setEdges(template.edges);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
  };

  const clearCanvas = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ quy trình?")) {
      setNodes([]);
      setEdges([]);
    }
  };

  const exportFlow = () => {
    const flowData = {
      nodes: getNodes(),
      edges: getEdges(),
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };
    downloadJson(flowData, `agent_flow_${Date.now()}.json`);
  };

  const exportAllOutputs = () => {
    const outputs = getNodes().filter(
      (n) => n.type === "output" && isExportableOutput(String(n.data?.value ?? "")),
    );
    if (outputs.length === 0) {
      alert("Không có kết quả output để xuất.");
      return;
    }
    outputs.forEach((n) => {
      downloadOutputFile(
        String(n.data.value),
        String(n.data.label ?? "output"),
        (n.data.exportFormat as OutputFileFormat | undefined) ?? "auto",
      );
    });
  };

  const outputCount = nodes.filter(
    (n) => n.type === "output" && isExportableOutput(String(n.data?.value ?? "")),
  ).length;

  const agentCount = nodes.filter((n) => n.type === "agent").length;
  const runningCount = nodes.filter((n) => n.data?.status === "running").length;
  const successCount = nodes.filter((n) => n.data?.status === "success").length;

  const flowStatusLabel = isProcessing
    ? "Đang chạy"
    : runningCount > 0
      ? "Đang xử lý"
      : successCount > 0 && successCount === nodes.length && nodes.length > 0
        ? "Hoàn tất"
        : "Thiết kế";

  const flowStatusClass = isProcessing || runningCount > 0
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : successCount > 0 && successCount === nodes.length && nodes.length > 0
      ? "bg-green-500/15 text-green-300 border-green-500/30"
      : "bg-white/5 text-white/50 border-white/10";

  const handleImportClick = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (json.nodes && Array.isArray(json.nodes)) {
          setNodes(json.nodes);
          setEdges(json.edges || []);
          setTimeout(() => fitView({ padding: 0.2 }), 100);
        } else {
          alert("Cấu trúc file JSON không hợp lệ.");
        }
      } catch {
        alert("Lỗi khi đọc file. Vui lòng chọn file JSON đúng định dạng.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow") as NodeType;
      const customDataStr = event.dataTransfer.getData("application/reactflow-data");

      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      let customData: Record<string, unknown> = {};
      if (customDataStr) {
        try {
          customData = JSON.parse(customDataStr);
        } catch (err) {
          console.error("Error parsing drop data", err);
        }
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: type === "agent" ? "AI Agent mới" : type === "output" ? "Kết quả mới" : "Đầu vào mới",
          prompt: "",
          model: "Gemini",
          isEditing: !customData.agentId,
          ...customData,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  const executeAll = () => {
    setIsProcessing(true);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "running" } })));

    setTimeout(() => {
      setIsProcessing(false);
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "success" } })));
    }, 3000);
  };

  return (
    <div className="flow-designer flex h-full w-full bg-[#0e0e0e] overflow-hidden relative">
      {flowLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <p className="text-sm text-white/70">Đang tải flow...</p>
        </div>
      )}
      {panelOpen && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
      <div
        className={`w-[min(300px,85vw)] border-r border-white/10 flex flex-col bg-[#111] z-30 shrink-0 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:transition-transform max-lg:duration-300 max-lg:shadow-xl ${
          panelOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        } lg:relative lg:translate-x-0`}
      >
        <div className="p-5 border-b border-white/5 flex justify-between items-center">
          <div className="min-w-0">
            <h2 className="text-[14px] font-black text-white uppercase tracking-widest leading-none truncate">
              Agent Flow
            </h2>
            <p className="text-[9px] text-white/30 mt-1 uppercase tracking-tighter">Workflow Architect</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={clearCanvas}
              className="w-8 h-8 rounded-lg hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-all flex items-center justify-center cursor-pointer"
            >
              <FlowIcon icon="trash" className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all flex items-center justify-center"
              aria-label="Close panel"
            >
              <FlowIcon icon="close" className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flow-dark-scrollbar p-4 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-1">Node cơ bản</h3>
            <div className="flex flex-col gap-2">
              <DraggableNodeItem type="start" label="Đầu vào (Trigger)" icon="input" color="text-blue-400" />
              <DraggableNodeItem type="agent" label="AI Agent (Xử lý)" icon="agent" color="text-purple-400" />
              <DraggableNodeItem type="output" label="Kết quả (Output)" icon="terminal" color="text-green-400" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[9px] font-bold text-blue-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <FlowIcon icon="sparkles" className="w-[14px] h-[14px]" />
              Mẫu Flow chuẩn
            </h3>
            <div className="flex flex-col gap-2">
              {FLOW_TEMPLATES.map((tmpl) => (
                <TemplateItem
                  key={tmpl.id}
                  label={tmpl.label}
                  description={tmpl.description}
                  icon={tmpl.icon}
                  onClick={() => applyTemplate(tmpl.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-1">AI Agents</h3>
            {agentsError && (
              <p className="text-[10px] text-red-400/80 px-1 leading-relaxed">{agentsError}</p>
            )}
            {agentsLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(userAgents.length > 0 || systemAgentGroups.length > 0) && (
                  <FlowCategoryFilter
                    categories={categories}
                    selectedId={categoryFilter}
                    onSelect={setCategoryFilter}
                    showUncategorized={hasUncategorizedAgents}
                  />
                )}

                {categoryFilter !== null && !hasFilteredAgents && (
                  <p className="text-[10px] text-white/30 px-1 py-1">
                    Không có agent trong nhóm này.
                  </p>
                )}

                {filteredUserAgents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[8px] font-bold text-emerald-400/60 uppercase tracking-widest px-1">
                      Agents của tôi
                    </p>
                    {filteredUserAgents.map((agent) => (
                      <FlowAgentDraggableItem key={`user-${agent.id}`} agent={agent} />
                    ))}
                  </div>
                )}

                {systemAgentGroups.length > 0 && filteredSystemAgents.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[8px] font-bold text-purple-400/60 uppercase tracking-widest px-1">
                      Agents mặc định
                    </p>

                    {categoryFilter === null ? (
                      filteredSystemGroups.map((group) => (
                        <FlowAgentCategorySection
                          key={group.category?.id ?? "uncategorized"}
                          group={group}
                        />
                      ))
                    ) : (
                      <div className="flex flex-col gap-2">
                        {filteredSystemAgents.map((agent) => (
                          <FlowAgentDraggableItem
                            key={`system-${agent.id}`}
                            agent={agent}
                            showSourceBadge={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {userAgents.length === 0 && systemAgentGroups.length === 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] text-white/30 px-1 leading-relaxed">
                      Chưa có agent. Dùng mẫu vai trò bên dưới hoặc tạo agent trong thư viện.
                    </p>
                    {sampleAgents.map((agent) => (
                      <FlowAgentDraggableItem key={agent.id} agent={agent} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-1">Lưu & Tải File</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportFlow}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all text-white/70 hover:text-white cursor-pointer"
              >
                <FlowIcon icon="download" className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Export</span>
              </button>
              <button
                onClick={handleImportClick}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all text-white/70 hover:text-white cursor-pointer"
              >
                <FlowIcon icon="upload" className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Import</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={executeAll}
            disabled={isProcessing}
            className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer font-bold shadow-xl active:scale-95 text-white"
          >
            <FlowIcon icon={isProcessing ? "sync" : "bolt"} className={`w-[22px] h-[22px] ${isProcessing ? "animate-spin" : ""}`} />
            <span className="text-[13px]">{isProcessing ? "Đang chạy..." : "Thực thi quy trình"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-w-0">
        <div className="absolute top-0 inset-x-0 z-20 flex items-start justify-between gap-2 p-3 pointer-events-none">
          {/* Status bar — top left */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto min-w-0">
            <MobileMenuButton className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-[#1a1a1a]/90 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0" />
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#1a1a1a]/90 border border-white/10 text-white/70 hover:text-white text-[11px] font-bold uppercase tracking-wide backdrop-blur-md shrink-0"
              aria-label="Open flow tools"
            >
              <FlowIcon icon="tune" className="w-[18px] h-[18px]" />
              <span className="hidden min-[480px]:inline">Tools</span>
            </button>

            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1a1a]/90 border border-white/10 backdrop-blur-md text-[11px] min-w-0">
              <Link
                href="/agents/flows"
                className="text-white/50 hover:text-white transition-colors shrink-0 hidden sm:inline"
                title="Danh sách flow"
              >
                Flows
              </Link>
              {flowName && (
                <>
                  <span className="text-white/30 hidden sm:inline">/</span>
                  <span className="text-white/80 font-medium truncate max-w-[140px] sm:max-w-[200px]">
                    {flowName}
                  </span>
                </>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide shrink-0 ${flowStatusClass}`}>
                {(isProcessing || runningCount > 0) && (
                  <FlowIcon icon="sync" className="w-3 h-3 animate-spin" />
                )}
                {flowStatusLabel}
              </span>
              <span className="text-white/40 hidden sm:inline">·</span>
              <span className="text-white/60 whitespace-nowrap">
                <span className="text-white/80 font-medium">{nodes.length}</span> node
              </span>
              <span className="text-white/40 hidden sm:inline">·</span>
              <span className="text-white/60 whitespace-nowrap hidden sm:inline">
                <span className="text-white/80 font-medium">{edges.length}</span> kết nối
              </span>
              {agentCount > 0 && (
                <>
                  <span className="text-white/40 hidden md:inline">·</span>
                  <span className="text-white/60 whitespace-nowrap hidden md:inline">
                    <span className="text-white/80 font-medium">{agentCount}</span> agent
                  </span>
                </>
              )}
              {outputCount > 0 && (
                <>
                  <span className="text-white/40 hidden md:inline">·</span>
                  <span className="text-green-400/80 whitespace-nowrap hidden md:inline">
                    {outputCount} output
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Import / Export / Save — top right */}
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            {saveError && (
              <span className="hidden lg:inline text-[10px] text-red-400 max-w-[160px] truncate" title={saveError}>
                {saveError}
              </span>
            )}
            <button
              type="button"
              onClick={() => void saveFlow()}
              disabled={saving || flowLoading}
              title="Lưu flow"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-indigo-600/90 border border-indigo-500/40 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all text-[11px] font-bold uppercase tracking-wide backdrop-blur-md"
            >
              <FlowIcon icon="save" className={`w-[18px] h-[18px] ${saving ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{saving ? "Đang lưu..." : "Lưu"}</span>
            </button>
            {outputCount > 0 && (
              <button
                type="button"
                onClick={exportAllOutputs}
                title="Xuất file kết quả output"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300/90 hover:text-green-200 hover:border-green-500/50 hover:bg-green-500/15 transition-all text-[11px] font-bold uppercase tracking-wide backdrop-blur-md"
              >
                <FlowIcon icon="save" className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">Xuất kết quả</span>
                <span className="sm:hidden">{outputCount}</span>
              </button>
            )}
            <input
              id="flow-json-import"
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={onFileChange}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <label
              htmlFor="flow-json-import"
              title="Import flow JSON"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#1a1a1a]/90 border border-white/10 text-white/70 hover:text-white hover:border-white/25 hover:bg-white/10 transition-all text-[11px] font-bold uppercase tracking-wide backdrop-blur-md cursor-pointer"
            >
              <FlowIcon icon="upload" className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Import</span>
            </label>
            <button
              type="button"
              onClick={exportFlow}
              title="Export flow JSON"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#1a1a1a]/90 border border-white/10 text-white/70 hover:text-white hover:border-white/25 hover:bg-white/10 transition-all text-[11px] font-bold uppercase tracking-wide backdrop-blur-md"
            >
              <FlowIcon icon="download" className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background color="#333" variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowEditor({ flowId = null }: { flowId?: string | null }) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner flowId={flowId} />
    </ReactFlowProvider>
  );
}
