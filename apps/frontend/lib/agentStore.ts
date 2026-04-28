/**
 * Guest agent store — persists agents in localStorage for unauthenticated users.
 *
 * Key: aichat.agents.guest
 * On login, AuthContext offers to import these agents to the server.
 */

import type { Agent } from "./types";

const GUEST_AGENTS_KEY = "aichat.agents.guest";

let _idCounter = Date.now();
const tempId = () => `guest_${(_idCounter++).toString(36)}`;

export function loadGuestAgents(): Agent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_AGENTS_KEY);
    return raw ? (JSON.parse(raw) as Agent[]) : [];
  } catch {
    return [];
  }
}

function persist(agents: Agent[]): void {
  localStorage.setItem(GUEST_AGENTS_KEY, JSON.stringify(agents));
}

export function createGuestAgent(data: Omit<Agent, "id" | "created_at" | "updated_at" | "owner_user_id">): Agent {
  const now = new Date().toISOString();
  const agent: Agent = {
    ...data,
    id: tempId(),
    is_public: false,
    created_at: now,
    updated_at: now,
  };
  const all = loadGuestAgents();
  persist([agent, ...all]);
  return agent;
}

export function updateGuestAgent(id: string, data: Partial<Agent>): Agent | null {
  const all = loadGuestAgents();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated = { ...all[idx], ...data, updated_at: new Date().toISOString() };
  all[idx] = updated;
  persist(all);
  return updated;
}

export function deleteGuestAgent(id: string): void {
  persist(loadGuestAgents().filter((a) => a.id !== id));
}

export function duplicateGuestAgent(id: string): Agent | null {
  const src = loadGuestAgents().find((a) => a.id === id);
  if (!src) return null;
  return createGuestAgent({ ...src, name: `${src.name} (copy)` });
}

export function clearGuestAgents(): void {
  localStorage.removeItem(GUEST_AGENTS_KEY);
}
