/**
 * Persona config sync helpers.
 *
 * Guest path  → stored in localStorage under PERSONA_KEY.
 * Auth path   → stored on server via PATCH /api/auth/me.
 *
 * After login the AuthContext calls resolvePersonaConflict() which
 * returns a ConflictResult the UI can act on.
 */

import type { PersonaConfig } from "./types";

export const PERSONA_STORAGE_KEY = "aichat.persona_config";

export const EMPTY_PERSONA: PersonaConfig = {
  persona: "",
  language: "",
  tone: "helpful",
};

// ── localStorage helpers ──────────────────────────────────────────────────────

export function loadLocalPersona(): PersonaConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersonaConfig;
  } catch {
    return null;
  }
}

export function saveLocalPersona(cfg: PersonaConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(cfg));
}

export function clearLocalPersona(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSONA_STORAGE_KEY);
}

export function isPersonaEmpty(cfg: PersonaConfig): boolean {
  return !cfg.persona && !cfg.language && (!cfg.tone || cfg.tone === "helpful");
}

// ── Conflict resolution ───────────────────────────────────────────────────────

export type ConflictResult =
  | { kind: "none" }                                    // nothing to do
  | { kind: "auto_upload"; localCfg: PersonaConfig }    // server was empty, auto-uploaded
  | { kind: "conflict"; localCfg: PersonaConfig; serverCfg: PersonaConfig }; // user must choose

/**
 * Call this right after a successful login/register.
 * Returns instructions for what to do; does NOT perform the PATCH itself
 * (the caller — AuthContext — handles it so we avoid a circular import with api.ts).
 */
export function resolvePersonaConflict(
  localCfg: PersonaConfig | null,
  serverCfg: PersonaConfig,
): ConflictResult {
  const localEmpty = !localCfg || isPersonaEmpty(localCfg);
  const serverEmpty = isPersonaEmpty(serverCfg);

  if (localEmpty) return { kind: "none" };
  if (serverEmpty) return { kind: "auto_upload", localCfg: localCfg! };
  return { kind: "conflict", localCfg: localCfg!, serverCfg };
}
