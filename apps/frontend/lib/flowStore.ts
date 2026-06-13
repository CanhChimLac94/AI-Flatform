/**
 * Guest flow store — persists flows in localStorage for unauthenticated users.
 */

import type { AgentFlow, AgentFlowSummary, FlowGraph } from "./types";

const GUEST_FLOWS_KEY = "aichat.flows.guest";

const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [], version: "1.0" };

let _idCounter = Date.now();
const tempId = () => `guest_flow_${(_idCounter++).toString(36)}`;

function graphCounts(graph: FlowGraph): { node_count: number; edge_count: number } {
  return {
    node_count: graph.nodes?.length ?? 0,
    edge_count: graph.edges?.length ?? 0,
  };
}

function toSummary(flow: AgentFlow): AgentFlowSummary {
  const counts = graphCounts(flow.graph);
  return {
    id: flow.id,
    owner_user_id: flow.owner_user_id,
    name: flow.name,
    description: flow.description,
    node_count: counts.node_count,
    edge_count: counts.edge_count,
    created_at: flow.created_at,
    updated_at: flow.updated_at,
  };
}

export function loadGuestFlows(): AgentFlow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_FLOWS_KEY);
    return raw ? (JSON.parse(raw) as AgentFlow[]) : [];
  } catch {
    return [];
  }
}

export function loadGuestFlowSummaries(): AgentFlowSummary[] {
  return loadGuestFlows().map(toSummary);
}

function persist(flows: AgentFlow[]): void {
  localStorage.setItem(GUEST_FLOWS_KEY, JSON.stringify(flows));
}

export function getGuestFlow(id: string): AgentFlow | null {
  return loadGuestFlows().find((f) => f.id === id) ?? null;
}

export function createGuestFlow(data: {
  name: string;
  description?: string;
  graph?: FlowGraph;
}): AgentFlow {
  const now = new Date().toISOString();
  const flow: AgentFlow = {
    id: tempId(),
    owner_user_id: "guest",
    name: data.name,
    description: data.description,
    graph: data.graph ?? EMPTY_GRAPH,
    ...graphCounts(data.graph ?? EMPTY_GRAPH),
    created_at: now,
    updated_at: now,
  };
  persist([flow, ...loadGuestFlows()]);
  return flow;
}

export function updateGuestFlow(
  id: string,
  data: Partial<Pick<AgentFlow, "name" | "description" | "graph">>,
): AgentFlow | null {
  const all = loadGuestFlows();
  const idx = all.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  const graph = data.graph ?? all[idx].graph;
  const updated: AgentFlow = {
    ...all[idx],
    ...data,
    graph,
    ...graphCounts(graph),
    updated_at: new Date().toISOString(),
  };
  all[idx] = updated;
  persist(all);
  return updated;
}

export function deleteGuestFlow(id: string): void {
  persist(loadGuestFlows().filter((f) => f.id !== id));
}

export function duplicateGuestFlow(id: string): AgentFlow | null {
  const src = getGuestFlow(id);
  if (!src) return null;
  return createGuestFlow({
    name: `${src.name} (copy)`,
    description: src.description ?? undefined,
    graph: structuredClone(src.graph),
  });
}
