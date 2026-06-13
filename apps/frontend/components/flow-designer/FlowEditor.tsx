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
import { AppUserMenu } from "@/components/layout/AppUserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useFlowAutoSaveSettings } from "@/hooks/useFlowAutoSaveSettings";
import { intervalMsFromSettings, isAutoSaveEnabled } from "@/lib/flowAutoSaveSettings";
import { FlowMetaEditor } from "./FlowMetaEditor";
import { FlowActionsMenu } from "./FlowActionsMenu";
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

function FlowEditorInner({ flowId = null, editMeta = false }: { flowId?: string | null; editMeta?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const { settings: autoSaveSettings, setSettings: setAutoSaveSettings } = useFlowAutoSaveSettings();
  const { userAgents, systemAgents, systemAgentGroups, categories, sampleAgents, loading: agentsLoading, error: agentsError } =
    useFlowAgents(isAuthenticated);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [resolvedFlowId, setResolvedFlowId] = useState<string | null>(flowId);
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [focusMetaName, setFocusMetaName] = useState(false);
  const [flowLoading, setFlowLoading] = useState(Boolean(flowId));
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const savingLockRef = useRef(false);
  const saveFlowRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!flowId) {
      setResolvedFlowId(null);
      setFlowName("");
      setFlowDescription("");
      setMetaExpanded(false);
      setFocusMetaName(false);
      setFlowLoading(false);
      setSaveError(null);
      setNodes(initialNodes);
      setEdges([]);
      lastSnapshotRef.current = null;
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
        setFlowDescription(flow.description ?? "");
        setMetaExpanded(Boolean(editMeta || flow.description));
        setFocusMetaName(editMeta);
        setNodes((flow.graph.nodes ?? []) as Node[]);
        setEdges((flow.graph.edges ?? []) as Edge[]);
        lastSnapshotRef.current = JSON.stringify({
          name: flow.name,
          description: flow.description ?? "",
          nodes: flow.graph.nodes ?? [],
          edges: flow.graph.edges ?? [],
        });
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
  }, [flowId, isAuthenticated, fitView, setNodes, setEdges, editMeta]);

  useEffect(() => {
    if (editMeta && !flowId) {
      setMetaExpanded(true);
      setFocusMetaName(true);
    }
  }, [editMeta, flowId]);

  useEffect(() => {
    if (!flowLoading && editMeta && resolvedFlowId) {
      router.replace(`/agents/flow/${resolvedFlowId}`, { scroll: false });
    }
  }, [flowLoading, editMeta, resolvedFlowId, router]);

  useEffect(() => {
    if (!flowLoading && focusMetaName) {
      const id = window.setTimeout(() => setFocusMetaName(false), 600);
      return () => window.clearTimeout(id);
    }
  }, [flowLoading, focusMetaName]);

  const buildSnapshot = useCallback(() => {
    return JSON.stringify({
      name: flowName,
      description: flowDescription,
      nodes: getNodes(),
      edges: getEdges(),
    });
  }, [flowName, flowDescription, getNodes, getEdges]);

  const saveFlow = useCallback(async (options?: { silent?: boolean }) => {
    if (savingLockRef.current) return;

    const snapshot = buildSnapshot();
    if (options?.silent && lastSnapshotRef.current !== null && snapshot === lastSnapshotRef.current) {
      return;
    }

    savingLockRef.current = true;
    if (options?.silent) {
      setAutoSaving(true);
    } else {
      setSaving(true);
    }
    setSaveError(null);

    const graph = {
      nodes: getNodes(),
      edges: getEdges(),
      version: "1.0",
    };
    const meta = {
      name: flowName.trim() || undefined,
      description: flowDescription.trim() || undefined,
    };

    try {
      if (isAuthenticated) {
        if (resolvedFlowId) {
          await updateFlow(resolvedFlowId, { ...meta, graph });
        } else {
          const created = await createFlow({
            name: flowName.trim() || `Flow ${new Date().toLocaleDateString("vi-VN")}`,
            description: meta.description,
            graph,
          });
          setResolvedFlowId(created.id);
          setFlowName(created.name);
          router.replace(`/agents/flow/${created.id}`);
        }
      } else if (resolvedFlowId) {
        updateGuestFlow(resolvedFlowId, { ...meta, graph });
      } else {
        const created = createGuestFlow({
          name: flowName.trim() || "Flow mới",
          description: meta.description,
          graph,
        });
        setResolvedFlowId(created.id);
        setFlowName(created.name);
        router.replace(`/agents/flow/${created.id}`);
      }
      lastSnapshotRef.current = snapshot;
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Lưu flow thất bại");
    } finally {
      savingLockRef.current = false;
      if (options?.silent) {
        setAutoSaving(false);
      } else {
        setSaving(false);
      }
    }
  }, [buildSnapshot, flowName, flowDescription, getEdges, getNodes, isAuthenticated, resolvedFlowId, router]);

  saveFlowRef.current = saveFlow;

  useEffect(() => {
    if (!flowLoading && lastSnapshotRef.current === null) {
      lastSnapshotRef.current = buildSnapshot();
    }
  }, [flowLoading, buildSnapshot]);

  useEffect(() => {
    const intervalMs = intervalMsFromSettings(autoSaveSettings);
    if (intervalMs <= 0 || flowLoading) return;

    const tick = () => {
      void saveFlowRef.current({ silent: true });
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [autoSaveSettings, flowLoading]);

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
    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
    : successCount > 0 && successCount === nodes.length && nodes.length > 0
      ? "bg-green-500/15 text-green-800 dark:text-green-300 border-green-500/30"
      : "bg-surface-elevated text-muted border-border";

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
    <div className="flow-designer flex h-full w-full bg-chat-bg overflow-hidden relative">
      {flowLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <p className="text-sm text-muted">Đang tải flow...</p>
        </div>
      )}
      {panelOpen && (
        <button
          type="button"
          aria-label="Close panel"
          className="fixed inset-0 bg-overlay z-20 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
      <div
        className={`w-[min(300px,85vw)] border-r border-border flex flex-col bg-sidebar z-30 shrink-0 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:transition-transform max-lg:duration-300 max-lg:shadow-xl ${
          panelOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        } lg:relative lg:translate-x-0`}
      >
        <div className="p-5 border-b border-border flex justify-between items-center">
          <div className="min-w-0">
            <h2 className="text-[14px] font-black text-foreground uppercase tracking-widest leading-none truncate">
              Agent Flow
            </h2>
            <p className="text-[9px] text-muted mt-1 uppercase tracking-tighter">Workflow Architect</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void saveFlow()}
              disabled={flowLoading || saving}
              aria-label={saving ? "Đang lưu flow" : "Lưu flow"}
              title={saving ? "Đang lưu..." : "Lưu flow"}
              className="w-8 h-8 rounded-lg hover:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-40 transition-all flex items-center justify-center cursor-pointer"
            >
              <FlowIcon icon="save" className={`w-[18px] h-[18px] ${saving ? "animate-pulse" : ""}`} />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              aria-label="Xóa toàn bộ flow trên canvas"
              title="Xóa flow"
              className="w-8 h-8 rounded-lg hover:bg-red-500/15 text-red-500/70 hover:text-red-500 transition-all flex items-center justify-center cursor-pointer"
            >
              <FlowIcon icon="trash" className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="lg:hidden w-8 h-8 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-all flex items-center justify-center"
              aria-label="Close panel"
            >
              <FlowIcon icon="close" className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flow-scrollbar p-4 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="text-[9px] font-bold text-muted uppercase tracking-widest px-1">Node cơ bản</h3>
            <div className="flex flex-col gap-2">
              <DraggableNodeItem type="start" label="Đầu vào (Trigger)" icon="input" color="text-blue-700 dark:text-blue-400" />
              <DraggableNodeItem type="agent" label="AI Agent (Xử lý)" icon="agent" color="text-purple-700 dark:text-purple-400" />
              <DraggableNodeItem type="output" label="Kết quả (Output)" icon="terminal" color="text-green-700 dark:text-green-400" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[9px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest px-1 flex items-center gap-2">
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
            <h3 className="text-[9px] font-bold text-muted uppercase tracking-widest px-1">AI Agents</h3>
            {agentsError && (
              <p className="text-[10px] text-red-400/80 px-1 leading-relaxed">{agentsError}</p>
            )}
            {agentsLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-surface-elevated animate-pulse" />
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
                  <p className="text-[10px] text-muted px-1 py-1">
                    Không có agent trong nhóm này.
                  </p>
                )}

                {filteredUserAgents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest px-1">
                      Agents của tôi
                    </p>
                    {filteredUserAgents.map((agent) => (
                      <FlowAgentDraggableItem key={`user-${agent.id}`} agent={agent} />
                    ))}
                  </div>
                )}

                {systemAgentGroups.length > 0 && filteredSystemAgents.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[8px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest px-1">
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
                    <p className="text-[10px] text-muted px-1 leading-relaxed">
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
            <h3 className="text-[9px] font-bold text-muted uppercase tracking-widest px-1">Lưu & Tải File</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportFlow}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-elevated border border-border hover:border-indigo-500/40 hover:bg-surface-hover transition-all text-muted hover:text-foreground cursor-pointer"
              >
                <FlowIcon icon="download" className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Export</span>
              </button>
              <button
                onClick={handleImportClick}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-elevated border border-border hover:border-indigo-500/40 hover:bg-surface-hover transition-all text-muted hover:text-foreground cursor-pointer"
              >
                <FlowIcon icon="upload" className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Import</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={executeAll}
            disabled={isProcessing}
            className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer font-bold shadow-xl active:scale-95 text-on-accent"
          >
            <FlowIcon icon={isProcessing ? "sync" : "bolt"} className={`w-[22px] h-[22px] ${isProcessing ? "animate-spin" : ""}`} />
            <span className="text-[13px]">{isProcessing ? "Đang chạy..." : "Thực thi quy trình"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-w-0">
        <div className="absolute top-0 inset-x-0 z-20 flex flex-col gap-1.5 p-3 pointer-events-none">
          <div className="flex flex-wrap items-start gap-2 pointer-events-auto min-w-0">
            <MobileMenuButton className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-input-bg border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0" />
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-input-bg border border-border text-muted hover:text-foreground text-[11px] font-bold uppercase tracking-wide shrink-0"
              aria-label="Open flow tools"
            >
              <FlowIcon icon="tune" className="w-[18px] h-[18px]" />
              <span className="hidden min-[480px]:inline">Tools</span>
            </button>

            <Link
              href="/agents/flows"
              className="text-muted hover:text-foreground transition-colors shrink-0 text-[11px] hidden sm:inline-flex items-center px-2 py-1.5 rounded-lg bg-input-bg border border-border"
              title="Danh sách flow"
            >
              Flows
            </Link>

            {!flowLoading && (
              <>
                <span className="text-muted hidden sm:inline shrink-0">/</span>
                <FlowMetaEditor
                  name={flowName}
                  description={flowDescription}
                  onNameChange={setFlowName}
                  onDescriptionChange={setFlowDescription}
                  expanded={metaExpanded}
                  onExpandedChange={setMetaExpanded}
                  disabled={flowLoading || saving}
                  autoFocusName={focusMetaName}
                  status={
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide shrink-0 ${flowStatusClass}`}
                      >
                        {(isProcessing || runningCount > 0) && (
                          <FlowIcon icon="sync" className="w-3 h-3 animate-spin" />
                        )}
                        {flowStatusLabel}
                      </span>
                      <span className="text-muted hidden min-[400px]:inline">·</span>
                      <span className="text-muted whitespace-nowrap hidden min-[400px]:inline">
                        <span className="text-foreground font-medium">{nodes.length}</span> node
                      </span>
                      <span className="text-muted hidden sm:inline">·</span>
                      <span className="text-muted whitespace-nowrap hidden sm:inline">
                        <span className="text-foreground font-medium">{edges.length}</span> kết nối
                      </span>
                      {agentCount > 0 && (
                        <>
                          <span className="text-muted hidden md:inline">·</span>
                          <span className="text-muted whitespace-nowrap hidden md:inline">
                            <span className="text-foreground font-medium">{agentCount}</span> agent
                          </span>
                        </>
                      )}
                      {outputCount > 0 && (
                        <>
                          <span className="text-muted hidden md:inline">·</span>
                          <span className="text-green-700 dark:text-green-400 whitespace-nowrap hidden md:inline">
                            {outputCount} output
                          </span>
                        </>
                      )}
                      {isAutoSaveEnabled(autoSaveSettings) && autoSaving && (
                        <>
                          <span className="text-muted hidden lg:inline">·</span>
                          <span className="text-indigo-600 dark:text-indigo-400 whitespace-nowrap hidden lg:inline">
                            {t("flows.autoSaving")}
                          </span>
                        </>
                      )}
                    </div>
                  }
                />
              </>
            )}

            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {saveError && (
                <span
                  className="hidden lg:inline text-[10px] text-red-400 max-w-[140px] truncate"
                  title={saveError}
                >
                  {saveError}
                </span>
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
              <FlowActionsMenu
                disabled={flowLoading}
                outputCount={outputCount}
                autoSaveSettings={autoSaveSettings}
                onAutoSaveSettingsChange={setAutoSaveSettings}
                onImport={handleImportClick}
                onExport={exportFlow}
                onExportOutputs={exportAllOutputs}
              />
              <AppUserMenu />
            </div>
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
          colorMode={theme === "light" ? "light" : "dark"}
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background color={theme === "light" ? "#d1d5db" : "#4b5563"} variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowEditor({ flowId = null, editMeta = false }: { flowId?: string | null; editMeta?: boolean }) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner flowId={flowId} editMeta={editMeta} />
    </ReactFlowProvider>
  );
}
