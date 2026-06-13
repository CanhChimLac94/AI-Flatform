export type NodeType = "start" | "agent" | "output";

export interface NodeData {
  label: string;
  role?: string;
  prompt?: string;
  model?: string;
  status?: "idle" | "running" | "success" | "error";
  value?: string;
  isEditing?: boolean;
  /** Preferred export format when using auto-detect */
  exportFormat?: "auto" | "txt" | "json" | "md" | "html" | "csv";
}

export interface AgentNodeState {
  id: string;
  type: NodeType;
  data: NodeData;
  position: { x: number; y: number };
}
